
import os
import torch
import librosa

from collections import Counter
from datasets import load_dataset, Audio
from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq
from jiwer import wer, cer


# ==============================
# SETTINGS
# ==============================

MODEL_PATH = (
    r"models\indicwhisper\tamil\tamil_models"
    r"\whisper-medium-ta_alldata_multigpu"
)

NUM_SAMPLES = 50
SAMPLE_RATE = 16000

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

model.eval()

print("Model loaded.")


# ==============================
# EVALUATION
# ==============================

references = []
predictions = []

sample_number = 0

temp_audio = r"data\audio\temp_kathbath.flac"

os.makedirs(
    os.path.dirname(temp_audio),
    exist_ok=True
)

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

    if audio_bytes is None:
        raise ValueError(
            f"Audio bytes are missing for sample {sample_number}"
        )

    with open(temp_audio, "wb") as f:
        f.write(audio_bytes)

    # --------------------------
    # Load and preprocess audio
    # --------------------------

    audio, sample_rate = librosa.load(
        temp_audio,
        sr=SAMPLE_RATE,
        mono=True
    )

    # --------------------------
    # Prepare input
    # --------------------------

    inputs = processor(
        audio,
        sampling_rate=SAMPLE_RATE,
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
    # Display transcripts
    # --------------------------

    print("\nReference Transcript:")
    print(ground_truth)

    print("\nIndicWhisper Prediction:")
    print(prediction)

    # --------------------------
    # Sample WER and CER
    # --------------------------

    sample_wer = wer(ground_truth, prediction)
    sample_cer = cer(ground_truth, prediction)

    print(f"\nSample WER: {sample_wer * 100:.2f}%")
    print(f"Sample CER: {sample_cer * 100:.2f}%")


# ==============================
# VERIFY EVALUATION COUNT
# ==============================

if not references:
    raise RuntimeError(
        "No samples were evaluated. Check the dataset and audio column."
    )

if len(references) < NUM_SAMPLES:
    print(
        f"\nWarning: Only {len(references)} samples were evaluated."
    )


# ==============================
# OVERALL WER AND CER
# ==============================

overall_wer = wer(references, predictions)
overall_cer = cer(references, predictions)


# ==============================
# TOKEN-LEVEL PRECISION, RECALL,
# AND F1-SCORE
# ==============================

total_tp = 0
total_fp = 0
total_fn = 0

for reference, prediction in zip(references, predictions):

    # Whitespace-separated Tamil tokens
    ref_tokens = reference.split()
    pred_tokens = prediction.split()

    ref_counts = Counter(ref_tokens)
    pred_counts = Counter(pred_tokens)

    # Multiset matching: repeated tokens are counted
    tp = sum((ref_counts & pred_counts).values())
    fp = sum((pred_counts - ref_counts).values())
    fn = sum((ref_counts - pred_counts).values())

    total_tp += tp
    total_fp += fp
    total_fn += fn


precision = (
    total_tp / (total_tp + total_fp)
    if total_tp + total_fp > 0
    else 0.0
)

recall = (
    total_tp / (total_tp + total_fn)
    if total_tp + total_fn > 0
    else 0.0
)

f1_score = (
    2 * precision * recall / (precision + recall)
    if precision + recall > 0
    else 0.0
)


# ==============================
# FINAL RESULTS
# ==============================

print("\n")
print("=" * 60)
print("KATHBATH 5-SAMPLE EVALUATION RESULTS")
print("=" * 60)

print(f"\nNumber of samples evaluated: {len(references)}")

print(f"\nOverall WER: {overall_wer * 100:.2f}%")
print(f"Overall CER: {overall_cer * 100:.2f}%")

print("\nToken-Level Metrics")
print("-" * 40)

print(f"True Positives (TP): {total_tp}")
print(f"False Positives (FP): {total_fp}")
print(f"False Negatives (FN): {total_fn}")

print(f"Precision: {precision * 100:.2f}%")
print(f"Recall: {recall * 100:.2f}%")
print(f"F1-score: {f1_score * 100:.2f}%")

print("\n" + "=" * 60)
print("Evaluation completed.")
print("=" * 60)


# ==============================
# CLEANUP TEMPORARY AUDIO
# ==============================

if os.path.exists(temp_audio):
    os.remove(temp_audio)
