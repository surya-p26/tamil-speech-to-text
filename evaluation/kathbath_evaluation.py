import os
import torch
import librosa

from datasets import load_dataset, Audio
from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq
from jiwer import wer, cer


# ==============================
# SETTINGS
# ==============================

MODEL_PATH = r"models\indicwhisper\tamil\tamil_models\whisper-medium-ta_alldata_multigpu"

NUM_SAMPLES = 5

device = "cuda" if torch.cuda.is_available() else "cpu"


# ==============================
# LOAD KATHBATH
# ==============================

print("Loading Kathbath Tamil dataset...")

ds = load_dataset(
    "ai4bharat/Kathbath",
    "tamil",
    split="valid",
    streaming=True
)

# Prevent automatic audio decoding
ds = ds.cast_column(
    "audio_filepath",
    Audio(decode=False)
)

print("Kathbath dataset ready.")


# ==============================
# LOAD MODEL
# ==============================

print("Device:", device)
print("Loading IndicWhisper...")

processor = AutoProcessor.from_pretrained(MODEL_PATH)

if device == "cpu":
    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        MODEL_PATH,
        dtype=torch.float32
    ).to(device)
else:
    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        MODEL_PATH,
        dtype=torch.float16
    ).to(device)

print("Model loaded.")


# ==============================
# EVALUATION
# ==============================

references = []
predictions = []

sample_number = 0

for sample in ds:

    if sample_number >= NUM_SAMPLES:
        break

    sample_number += 1

    print("\n" + "=" * 60)
    print(f"Processing Sample {sample_number}/{NUM_SAMPLES}")
    print("=" * 60)

    # --------------------------
    # Get audio bytes
    # --------------------------

    audio_info = sample["audio_filepath"]
    audio_bytes = audio_info["bytes"]

    temp_audio = r"data\audio\temp_kathbath.flac"

    os.makedirs(
        os.path.dirname(temp_audio),
        exist_ok=True
    )

    with open(temp_audio, "wb") as f:
        f.write(audio_bytes)

    # --------------------------
    # Load and preprocess audio
    # --------------------------

    audio, sample_rate = librosa.load(
        temp_audio,
        sr=16000,
        mono=True
    )

    # --------------------------
    # Prepare input
    # --------------------------

    inputs = processor(
        audio,
        sampling_rate=16000,
        return_tensors="pt"
    )

    input_features = inputs.input_features.to(device)

    # --------------------------
    # Transcribe
    # --------------------------

    print("Transcribing...")

    with torch.no_grad():

        generated_ids = model.generate(
            input_features,
            language="ta",
            task="transcribe"
        )

    prediction = processor.batch_decode(
        generated_ids,
        skip_special_tokens=True
    )[0].strip()

    ground_truth = sample["text"].strip()

    # --------------------------
    # Store results
    # --------------------------

    references.append(ground_truth)
    predictions.append(prediction)

    # --------------------------
    # Display
    # --------------------------

    print("\nGround Truth:")
    print(ground_truth)

    print("\nPrediction:")
    print(prediction)

    sample_wer = wer(
        ground_truth,
        prediction
    )

    sample_cer = cer(
        ground_truth,
        prediction
    )

    print("\nSample WER:", round(sample_wer * 100, 2), "%")
    print("Sample CER:", round(sample_cer * 100, 2), "%")


# ==============================
# FINAL RESULTS
# ==============================

overall_wer = wer(
    references,
    predictions
)

overall_cer = cer(
    references,
    predictions
)


print("\n")
print("=" * 60)
print("KATHBATH 5-SAMPLE EVALUATION RESULT")
print("=" * 60)

print("\nNumber of samples:", NUM_SAMPLES)

print("\nOverall WER:")
print(round(overall_wer * 100, 2), "%")

print("\nOverall CER:")
print(round(overall_cer * 100, 2), "%")

print("\n" + "=" * 60)
print("Evaluation completed successfully.")
print("=" * 60)