"""Dependency-free tests for Tamil text cleanup and punctuation restoration."""
import unittest

from postprocessing import tamil_text


class FakePunctuationModel:
    def __init__(self, result: str):
        self.result = result

    def punctuate(self, texts, batch_size=1):
        return [self.result for _ in texts]


class TamilPostprocessingTests(unittest.TestCase):
    def test_clean_text_normalizes_unicode_and_whitespace(self):
        result = tamil_text.clean_tamil_text("  தமிழ்நாடு   அரசு \n  வருகிறது  ")
        self.assertEqual(result, "தமிழ்நாடு அரசு\nவருகிறது.")

    def test_clean_text_preserves_existing_question_mark(self):
        result = tamil_text.clean_tamil_text("நீங்கள் எப்படி இருக்கிறீர்கள் ?  ")
        self.assertEqual(result, "நீங்கள் எப்படி இருக்கிறீர்கள்?")

    def test_model_punctuation_is_used_when_words_are_preserved(self):
        original_loader = tamil_text._load_punctuation_model
        tamil_text._load_punctuation_model = lambda: FakePunctuationModel(
            "தமிழ்நாடு அரசு, பல்வேறு நலத்திட்டங்களை செயல்படுத்தி வருகிறது."
        )
        try:
            result = tamil_text.restore_tamil_punctuation(
                "தமிழ்நாடு அரசு பல்வேறு நலத்திட்டங்களை செயல்படுத்தி வருகிறது"
            )
            self.assertEqual(
                result,
                "தமிழ்நாடு அரசு, பல்வேறு நலத்திட்டங்களை செயல்படுத்தி வருகிறது.",
            )
        finally:
            tamil_text._load_punctuation_model = original_loader

    def test_model_output_is_rejected_if_it_changes_words(self):
        original_loader = tamil_text._load_punctuation_model
        tamil_text._load_punctuation_model = lambda: FakePunctuationModel(
            "வணக்கம் நண்பர்களே உங்கள் நாள் நல்ல நாளாக அமையட்டும்."
        )
        try:
            with self.assertRaises(tamil_text.PunctuationModelUnavailable):
                tamil_text.restore_tamil_punctuation(
                    "தமிழ்நாடு அரசு பல்வேறு நலத்திட்டங்களை செயல்படுத்தி வருகிறது"
                )
        finally:
            tamil_text._load_punctuation_model = original_loader

    def test_model_rewritten_words_are_never_admitted_into_transcript(self):
        original_loader = tamil_text._load_punctuation_model
        # Model hallucinated different middle words
        tamil_text._load_punctuation_model = lambda: FakePunctuationModel(
            "தமிழ்நாடு அரசு புதிய திட்டங்களை செயல்படுத்துகிறது."
        )
        try:
            original = "தமிழ்நாடு அரசு பல்வேறு நலத்திட்டங்களை செயல்படுத்தி வருகிறது"
            result = tamil_text.restore_tamil_punctuation(original)
            # The result MUST keep original words and not substitute model's hallucinated words
            self.assertEqual(tamil_text._lexical_tokens(result), tamil_text._lexical_tokens(original))
        finally:
            tamil_text._load_punctuation_model = original_loader


if __name__ == "__main__":
    unittest.main()
