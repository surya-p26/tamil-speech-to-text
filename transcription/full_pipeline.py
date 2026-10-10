import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from document.pdf_generator import generate_pdf
import os
import torch
import librosa
import soundfile as sf

from transformers import pipeline
from postprocessing.tamil_text import clean_tamil_text
from document.docx_generator import generate_docx


# ============================================================
# 1. AUDIO PREPROCESSING
# ============================================================

def preprocess_audio(input_file, output_file):

    print("\n[1/4] Preprocessing audio...")
    print("Input:", input_file)

    if not os.path.exists(input_file):
        print("ERROR: Audio file not found.")
        return False

    try:
        audio, sample_rate = librosa.load(
            input_file,
            sr=16000,
            mono=True
        )

        print("Audio loaded successfully.")
        print("Sample rate:", sample_rate)
        print("Converted to: 16 kHz, Mono")

        # Normalize audio
        max_value = max(abs(audio))

        if max_value > 0:
            audio = audio / max_value

        # Create output folder
        output_directory = os.path.dirname(output_file)

        if output_directory:
            os.makedirs(output_directory, exist_ok=True)

        # Save processed audio
        sf.write(
            output_file,
            audio,
            16000
        )

        print("Processed audio saved to:")
        print(output_file)

        return True

    except Exception as e:

        print("ERROR during preprocessing:")
        print(e)

        return False


# ============================================================
# 2. INDICWHISPER TRANSCRIPTION
# ============================================================

def transcribe_audio(audio_file):

    MODEL_PATH = (
        r"models\indicwhisper\tamil\tamil_models"
        r"\whisper-medium-ta_alldata_multigpu"
    )

    print("\n[2/4] Loading IndicWhisper...")

    # Select CPU or GPU
    device = "cuda" if torch.cuda.is_available() else "cpu"

    print("Device:", device)

    # Load IndicWhisper
    asr = pipeline(
        "automatic-speech-recognition",
        model=MODEL_PATH,
        device=device
    )

    print("IndicWhisper loaded successfully.")

    print("\n[3/4] Transcribing audio...")

    # Tamil transcription
    result = asr(
        audio_file,
        generate_kwargs={
            "language": "ta",
            "task": "transcribe"
        }
    )

    transcription = result["text"].strip()

    return transcription


# ============================================================
# 3. TEXT POST-PROCESSING
# ============================================================

def postprocess_transcription(text):

    print("\n[4/4] Post-processing Tamil text...")

    cleaned_text = clean_tamil_text(text)

    return cleaned_text


# ============================================================
# 4. MAIN PIPELINE
# ============================================================

if __name__ == "__main__":

    # Original user audio
    input_audio = r"data\audio\test_tamil.ogg"

    # Automatically generated processed audio
    processed_audio = r"data\audio\processed_tamil.wav"

    print("========================================")
    print(" Tamil Speech-to-Text Pipeline")
    print("========================================")

    # Step 1: Preprocess
    success = preprocess_audio(
        input_audio,
        processed_audio
    )

    if not success:
        print("\nPipeline stopped because preprocessing failed.")
        exit()

    # Step 2: Transcription
    raw_transcription = transcribe_audio(
        processed_audio
    )

    print("\n========================================")
    print("Raw Tamil Transcription:")
    print("========================================")
    print(raw_transcription)

    # Step 3: Post-processing
    final_transcription = postprocess_transcription(
        raw_transcription
    )

    print("\n========================================")
    print("Final Tamil Transcription:")
    print("========================================")
    print(final_transcription)
    print("========================================")

    print("\nPipeline completed successfully!")
    pdf_output = r"data\audio\final_tamil_transcription.pdf"

    generate_pdf(
        final_transcription,
        pdf_output
    )

    docx_output = r"data\audio\final_tamil_transcription.docx"

    generate_docx(
        final_transcription,
        docx_output
    )