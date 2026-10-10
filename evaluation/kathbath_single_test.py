from datasets import load_dataset, Audio
import os

# Load Kathbath in streaming mode
ds = load_dataset(
    "ai4bharat/Kathbath",
    "tamil",
    split="valid",
    streaming=True
)

# Don't decode automatically
ds = ds.cast_column(
    "audio_filepath",
    Audio(decode=False)
)

# Get one sample
sample = next(iter(ds))

audio_info = sample["audio_filepath"]

# Save the audio bytes
audio_bytes = audio_info["bytes"]

output_file = r"data\audio\kathbath_sample.flac"

os.makedirs(os.path.dirname(output_file), exist_ok=True)

with open(output_file, "wb") as f:
    f.write(audio_bytes)

print("Audio downloaded successfully!")
print("Saved to:", output_file)
print("Filename:", sample["fname"])
print("Duration:", sample["duration"])
print("Ground Truth:")
print(sample["text"])