import torch
from transformers import pipeline

MODEL_PATH = r"models\indicwhisper\tamil\tamil_models\whisper-medium-ta_alldata_multigpu"
AUDIO_PATH = r"data\audio\processed_tamil.wav"

device = "cuda" if torch.cuda.is_available() else "cpu"

print("Loading IndicWhisper...")

asr = pipeline(
    "automatic-speech-recognition",
    model=MODEL_PATH,
    device=device
)

# Tell Whisper to transcribe Tamil
asr.model.config.forced_decoder_ids = (
    asr.tokenizer.get_decoder_prompt_ids(
        language="ta",
        task="transcribe"
    )
)

print("Transcribing audio...")

result = asr(AUDIO_PATH)

print("\nTamil Transcription:")
print(result["text"])