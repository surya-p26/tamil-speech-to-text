from jiwer import wer, cer


def evaluate_transcription(reference_text, predicted_text):

    word_error_rate = wer(
        reference_text,
        predicted_text
    )

    character_error_rate = cer(
        reference_text,
        predicted_text
    )

    print("\n========================================")
    print("Tamil Speech-to-Text Evaluation")
    print("========================================")

    print("Reference Text:")
    print(reference_text)

    print("\nPredicted Text:")
    print(predicted_text)

    print("\nWER:", round(word_error_rate * 100, 2), "%")
    print("CER:", round(character_error_rate * 100, 2), "%")

    return word_error_rate, character_error_rate


if __name__ == "__main__":

    reference = "தமிழ்நாடு அரசு பல்வேறு நலத்திட்டங்களை செயல்படுத்தி வருகிறது"

    predicted = "தமிழ்நாடு அரசு பல்வேறு நலத்திட்டங்களை செயல்படுத்தி வருகிறது"

    evaluate_transcription(
        reference,
        predicted
    )