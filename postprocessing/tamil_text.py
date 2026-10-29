"""Tamil transcript normalization and optional AI punctuation restoration.

Safe cleanup is dependency-free. Cadence-Fast is loaded lazily only when the
user explicitly requests AI punctuation restoration from the post-processing
screen. This module never accepts model changes to the transcript's word sequence.
"""
from __future__ import annotations

import re
import threading
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUNCTUATION_MODEL_DIR = PROJECT_ROOT / "models" / "punctuation" / "cadence-fast"

_PUNCTUATION_MODEL = None
_PUNCTUATION_MODEL_LOCK = threading.Lock()

_LEXICAL_TOKEN_RE = re.compile(r"[0-9A-Za-z\u0B80-\u0BFF]+", re.UNICODE)
_PUNCTUATION_ENDINGS = ".!?…।"
_PUNCTUATION_MARK_RE = re.compile(r"[,.;:!?…।]")


class PunctuationModelUnavailable(RuntimeError):
    """Raised when the optional Tamil punctuation model cannot be loaded."""


def _space_and_punctuation_cleanup(text: str) -> str:
    """Normalize Unicode and whitespace without changing lexical content."""
    if not isinstance(text, str):
        raise TypeError("Tamil transcript must be a string.")

    text = unicodedata.normalize("NFC", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\u00a0", " ")
    cleaned_lines: list[str] = []
    for line in text.split("\n"):
        line = re.sub(r"[\t\f\v ]+", " ", line).strip()
        line = re.sub(r"\s+([,;:!?…।.])", r"\1", line)
        line = re.sub(r"([,;:!?])(?=\S)", r"\1 ", line)
        line = re.sub(r"([([{])\s+", r"\1", line)
        line = re.sub(r"\s+([\]\)}])", r"\1", line)
        line = re.sub(r"([!?])\1{1,}", r"\1", line)
        cleaned_lines.append(line)

    text = "\n".join(cleaned_lines)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def clean_tamil_text(text: str) -> str:
    """Perform conservative normalization for ASR output."""
    cleaned = _space_and_punctuation_cleanup(text)
    if cleaned and cleaned[-1] not in _PUNCTUATION_ENDINGS:
        cleaned += "."
    return cleaned


def _load_punctuation_model():
    """Load and cache Cadence-Fast only when AI punctuation is requested."""
    global _PUNCTUATION_MODEL
    if _PUNCTUATION_MODEL is not None:
        return _PUNCTUATION_MODEL

    with _PUNCTUATION_MODEL_LOCK:
        if _PUNCTUATION_MODEL is not None:
            return _PUNCTUATION_MODEL
        try:
            try:
                from cadence import PunctuationModel
            except ImportError:
                from Cadence import PunctuationModel  # type: ignore[no-redef]

            PUNCTUATION_MODEL_DIR.mkdir(parents=True, exist_ok=True)
            print("Loading optional Tamil punctuation model (AI4Bharat Cadence-Fast)...")
            _PUNCTUATION_MODEL = PunctuationModel(
                model="Cadence-Fast",
                model_path=str(PUNCTUATION_MODEL_DIR),
                cpu=True,
                d_type="float32",
                sliding_window=True,
                verbose=False,
            )
            print("Cadence-Fast punctuation model loaded.")
            return _PUNCTUATION_MODEL
        except Exception as exc:
            _PUNCTUATION_MODEL = None
            raise PunctuationModelUnavailable(
                "Tamil AI punctuation model could not be loaded. Check the activated "
                "venv and requirements-punctuation.txt, then restart FastAPI. "
                "Your original transcript has not been changed."
            ) from exc


def _lexical_tokens(text: str) -> list[str]:
    return [
        token.casefold()
        for token in _LEXICAL_TOKEN_RE.findall(unicodedata.normalize("NFC", text))
    ]


def _transfer_punctuation_to_original(original: str, model_output: str) -> str:
    """Transfer model punctuation only after exact matched lexical tokens."""
    original_spans = list(_LEXICAL_TOKEN_RE.finditer(original))
    model_spans = list(_LEXICAL_TOKEN_RE.finditer(model_output))
    original_tokens = [m.group(0).casefold() for m in original_spans]
    model_tokens = [m.group(0).casefold() for m in model_spans]

    matcher = SequenceMatcher(None, original_tokens, model_tokens, autojunk=False)
    original_to_model: dict[int, int] = {}
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for offset in range(i2 - i1):
                original_to_model[i1 + offset] = j1 + offset

    if not original_to_model:
        raise PunctuationModelUnavailable(
            "The punctuation model changed too many words to safely align its punctuation. "
            "No AI punctuation was applied; your original transcript has not been changed."
        )

    model_suffix_marks: dict[int, str] = {}
    for model_index, span in enumerate(model_spans):
        gap_end = (
            model_spans[model_index + 1].start()
            if model_index + 1 < len(model_spans)
            else len(model_output)
        )
        marks = "".join(_PUNCTUATION_MARK_RE.findall(model_output[span.end():gap_end]))
        if marks:
            model_suffix_marks[model_index] = marks

    parts: list[str] = []
    cursor = 0
    for original_index, span in enumerate(original_spans):
        parts.append(original[cursor:span.end()])
        gap_end = (
            original_spans[original_index + 1].start()
            if original_index + 1 < len(original_spans)
            else len(original)
        )
        gap = original[span.end():gap_end]
        model_index = original_to_model.get(original_index)
        predicted_marks = model_suffix_marks.get(model_index, "") if model_index is not None else ""
        if predicted_marks and not _PUNCTUATION_MARK_RE.search(gap):
            parts.append(predicted_marks)
        parts.append(gap)
        cursor = gap_end

    return "".join(parts)


_TAMIL_QUESTION_WORDS = {
    "எப்படி", "எங்கே", "எங்கு", "எப்போது", "என்ன", "யார்", "ஏன்",
    "எதற்கு", "எதனால்", "எவ்வளவு", "எத்தனை", "எந்த", "எங்க", "எப்ப",
    "என்னங்க",
}
_TAMIL_SUBJECT_WORDS = {
    "நான்", "நாங்க", "நாங்கள்", "நீ", "நீங்கள்", "அவர்", "அவர்கள்",
    "அவள்", "அவங்க", "இது", "அது",
}
_TAMIL_SECOND_PERSON_WORDS = {"உங்க", "உங்கள்", "உங்களுடைய", "உங்களுக்கு", "உங்கள"}
_TAMIL_GREETING_WORDS = {"வணக்கம்", "ஹாய்", "ஹலோ", "நமஸ்காரம்"}
_TAMIL_QUESTION_ENDINGS = {
    "நலமா", "சரியா", "தயாரா", "வேண்டுமா", "வேணுமா", "இருக்கா",
    "இருக்கீங்களா", "இருக்கீர்களா", "சாப்பிட்டீங்களா", "சாப்பிட்டாயா",
    "வருகிறீர்களா", "வருவீர்களா", "போகலாமா", "சொல்லட்டுமா",
}

# High-confidence boundary cues used only if the AI output is incomplete or
# pathological. This is a practical fallback, not a full Tamil grammar parser.
_TAMIL_SENTENCE_STARTS = {
    "இன்று", "இன்றைய", "நாளை", "தற்போது", "இப்போது", "இதற்கிடையில்", "மேலும்",
    "வெளியே", "சாலைகளில்", "ஏதேனும்", "அடுத்து", "அடுத்ததாக", "பின்னர்",
    "எனவே", "இதனால்", "இருப்பினும்", "முக்கியமாக", "மற்றபடி",
    "ஒவ்வொரு", "மரங்களை", "நிகழ்ச்சியில்", "நிகழ்வில்", "முதலில்", "இறுதியாக", "நன்றி",
}
_TAMIL_SENTENCE_ENDINGS = {
    "உள்ளது", "உள்ளன", "இருக்கிறது", "இருக்கின்றது", "இருக்கும்", "ஆகும்",
    "முடியும்", "வேண்டும்", "செல்லுங்கள்", "ஓட்டுங்கள்", "செய்யுங்கள்",
    "கொள்ளுங்கள்", "பாருங்கள்", "கேளுங்கள்", "தெரிவிக்கவும்", "கவனிக்கவும்",
    "பின்பற்றுங்கள்", "பயன்படுத்துங்கள்", "தொடர்புகொள்ளுங்கள்",
    "நடைபெறுகிறது", "நடைபெறுகின்றது", "நடைபெறும்", "நடக்கிறது",
    "தொடங்குகிறது", "முடிந்தது", "அமைகிறது", "அமையும்", "கடமை",
}


def _internal_punctuation_count(text: str) -> int:
    """Count punctuation marks before a later lexical token (not final marks)."""
    return sum(
        1 for mark in _PUNCTUATION_MARK_RE.finditer(text)
        if _LEXICAL_TOKEN_RE.search(text[mark.end():])
    )


def _is_overpunctuated(text: str) -> bool:
    token_count = len(_lexical_tokens(text))
    if token_count < 6:
        return False
    return _internal_punctuation_count(text) > max(2, token_count // 4)


def _conservative_tamil_punctuation(text: str) -> str:
    """Add punctuation at recognizable Tamil greeting, discourse, and clause cues."""
    plain = _PUNCTUATION_MARK_RE.sub("", unicodedata.normalize("NFC", text))
    plain = re.sub(r"\s+", " ", plain).strip()
    if not plain:
        return ""

    words = plain.split(" ")
    folded = [word.casefold() for word in words]
    punctuation_after: dict[int, str] = {}
    greeting_audiences = {"அனைவருக்கும்", "எல்லோருக்கும்", "அன்புடையீர்", "நண்பர்களே"}

    # "வணக்கம் அனைவருக்கும் காலை வணக்கம் ..." -> "வணக்கம் அனைவருக்கும்! காலை வணக்கம்."
    if len(words) >= 3 and folded[0] in _TAMIL_GREETING_WORDS and folded[1] in greeting_audiences:
        punctuation_after[1] = "!"

    # "அனைவருக்கும் வணக்கம் இன்று ..." -> "... வணக்கம். இன்று ..."
    if (
        len(words) >= 3
        and folded[0] in greeting_audiences
        and folded[1] in _TAMIL_GREETING_WORDS
        and folded[2] in _TAMIL_SENTENCE_STARTS
    ):
        punctuation_after[1] = "."

    # "காலை வணக்கம் இன்று/இன்றைய ..." -> "... வணக்கம். இன்று/இன்றைய ..."
    for i in range(len(words) - 2):
        if folded[i] == "காலை" and folded[i + 1] == "வணக்கம்" and folded[i + 2] in _TAMIL_SENTENCE_STARTS:
            punctuation_after[i + 1] = "."

    # Letter/message closing phrases.
    signoffs = {"இப்படிக்கு", "அன்புடன்", "நன்றியுடன்", "தங்கள்", "தங்களுடைய"}
    signoff_index = next((i for i, token in enumerate(folded) if token in signoffs), None)
    if signoff_index is not None:
        if signoff_index > 0:
            punctuation_after.setdefault(signoff_index - 1, ".")
        if folded[signoff_index] in {"இப்படிக்கு", "அன்புடன்", "நன்றியுடன்"} and signoff_index < len(words) - 1:
            punctuation_after[signoff_index] = ","

    # Put a sentence break after a high-confidence ending followed by a discourse starter.
    for i in range(len(words) - 1):
        if folded[i] in _TAMIL_SENTENCE_ENDINGS and folded[i + 1] in _TAMIL_SENTENCE_STARTS:
            punctuation_after.setdefault(i, ".")

    # Greeting followed by a name before a question.
    if len(words) >= 3 and folded[0] in _TAMIL_GREETING_WORDS and any(
        token in _TAMIL_QUESTION_WORDS for token in folded[2:]
    ):
        punctuation_after[1] = ","

    # A question clause followed by a new subject/answer.
    question_index = next((i for i, token in enumerate(folded) if token in _TAMIL_QUESTION_WORDS), None)
    if question_index is not None:
        next_subject = next(
            (i for i in range(question_index + 1, len(words)) if folded[i] in _TAMIL_SUBJECT_WORDS),
            None,
        )
        if next_subject is not None and next_subject > 0:
            punctuation_after[next_subject - 1] = "?"

    # Separate first-person statement from a second-person question.
    first_person_index = next(
        (i for i, token in enumerate(folded) if token in {"நான்", "நாங்க", "நாங்கள்"}),
        None,
    )
    second_person_index = next(
        (i for i, token in enumerate(folded) if token in _TAMIL_SECOND_PERSON_WORDS),
        None,
    )
    if first_person_index is not None and second_person_index is not None:
        prior_words = folded[first_person_index:second_person_index]
        last_prior = prior_words[-1] if prior_words else ""
        if second_person_index > first_person_index + 1 and any(
            last_prior.endswith(suffix)
            for suffix in ("ேன்", "றேன்", "கிறேன்", "ட்டேன்", "ிருக்கேன்")
        ):
            punctuation_after.setdefault(second_person_index - 1, ".")

    final_word = folded[-1]
    if final_word in _TAMIL_QUESTION_ENDINGS or final_word in _TAMIL_QUESTION_WORDS:
        punctuation_after[len(words) - 1] = "?"
    else:
        punctuation_after.setdefault(len(words) - 1, ".")

    rendered: list[str] = []
    for index, word in enumerate(words):
        rendered.append(word)
        mark = punctuation_after.get(index)
        if mark:
            rendered.append(mark)
        if index < len(words) - 1:
            rendered.append(" ")
    return _space_and_punctuation_cleanup("".join(rendered))


def restore_tamil_punctuation(text: str) -> str:
    """Restore punctuation without accepting model-rewritten words."""
    normalized = _space_and_punctuation_cleanup(text)
    if not normalized:
        return ""

    model = _load_punctuation_model()
    try:
        results = model.punctuate([normalized], batch_size=1)
        punctuated = results[0] if results else normalized
    except Exception as exc:
        raise PunctuationModelUnavailable(
            "Cadence-Fast could not restore punctuation for this transcript. "
            "Your original transcript has not been changed."
        ) from exc

    if not isinstance(punctuated, str) or not punctuated.strip():
        raise PunctuationModelUnavailable(
            "The punctuation model returned empty text. Your original transcript has not been changed."
        )

    punctuated = _space_and_punctuation_cleanup(punctuated)
    if _lexical_tokens(normalized) != _lexical_tokens(punctuated):
        punctuated = _transfer_punctuation_to_original(normalized, punctuated)
        punctuated = _space_and_punctuation_cleanup(punctuated)

    if _is_overpunctuated(punctuated):
        punctuated = _conservative_tamil_punctuation(normalized)
    else:
        # IMPORTANT: the fallback also runs when the model added only one internal
        # full stop, not just when it returned zero punctuation. Prefer our
        # candidate only if it adds more known, conservative boundaries.
        enough_text = len(_lexical_tokens(normalized)) >= 8
        if enough_text:
            candidate = _conservative_tamil_punctuation(normalized)
            if (
                _lexical_tokens(candidate) == _lexical_tokens(normalized)
                and _internal_punctuation_count(candidate) > _internal_punctuation_count(punctuated)
            ):
                punctuated = candidate

    if _lexical_tokens(normalized) != _lexical_tokens(punctuated):
        raise PunctuationModelUnavailable(
            "AI punctuation could not be safely mapped to the original words. "
            "Your original transcript has not been changed."
        )

    if punctuated and punctuated[-1] not in _PUNCTUATION_ENDINGS:
        punctuated += "."
    return punctuated
