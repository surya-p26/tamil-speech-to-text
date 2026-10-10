import os
import subprocess
import librosa
import soundfile as sf


def preprocess_audio(input_file, output_file):
    print("Loading audio...")
    print("Input file:", input_file)

    # Check if input file exists
    if not os.path.exists(input_file):
        print("ERROR: Input audio file not found.")
        return

    try:
        # Load audio using librosa
        # sr=16000 -> convert to 16 kHz
        # mono=True -> convert to mono
        audio, sample_rate = librosa.load(
            input_file,
            sr=16000,
            mono=True
        )

        print("Audio loaded successfully.")
        print("Sample rate:", sample_rate)
        print("Audio converted to mono and 16 kHz")

        # Normalize audio
        max_value = max(abs(audio))

        if max_value > 0:
            audio = audio / max_value

        # Create output directory if it doesn't exist
        output_directory = os.path.dirname(output_file)

        if output_directory:
            os.makedirs(output_directory, exist_ok=True)

        # Save processed audio
        sf.write(
            output_file,
            audio,
            16000
        )

        print("Preprocessed audio saved to:")
        print(output_file)

    except Exception as e:
        print("ERROR while preprocessing audio:")
        print(e)


if __name__ == "__main__":

    # ------------------------------------------------
    # CHANGE ONLY THIS FILE NAME FOR DIFFERENT AUDIO
    # ------------------------------------------------

    input_audio = r"data\audio\test_tamil.ogg"

    # Standard output file for IndicWhisper
    output_audio = r"data\audio\processed_tamil.wav"

    preprocess_audio(
        input_audio,
        output_audio
    )