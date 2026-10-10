import torch
from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq

MODEL_PATH = r"models\indicwhisper\tamil\tamil_models\whisper-medium-ta_alldata_multigpu"

print("Loading processor...")

processor = AutoProcessor.from_pretrained(MODEL_PATH)

print("Loading model...")

model = AutoModelForSpeechSeq2Seq.from_pretrained(
    MODEL_PATH,
    torch_dtype=torch.float32
)

model.eval()

print("Model loaded successfully!")
print("Device:", "cuda" if torch.cuda.is_available() else "cpu")