import re


def clean_tamil_text(text):
    """
    Clean and normalize Tamil transcription text.
    """

    # Remove extra spaces
    text = re.sub(r"\s+", " ", text)

    # Remove spaces before punctuation
    text = re.sub(r"\s+([,.!?;:])", r"\1", text)

    # Remove unnecessary spaces at beginning/end
    text = text.strip()

    return text


if __name__ == "__main__":

    sample_text = """
    தமிழ்நாடு அரசு    பல்வேறு நலத்திட்டங்களை
    செயல்படுத்தி வருகிறது .
    """

    cleaned_text = clean_tamil_text(sample_text)

    print("Original Text:")
    print(sample_text)

    print("\nCleaned Text:")
    print(cleaned_text)