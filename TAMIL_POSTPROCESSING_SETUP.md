# TamilTranscribe — Tamil punctuation restoration

TamilTranscribe's existing `clean_tamil_text()` remains a conservative, dependency-free cleanup step: Unicode NFC normalization, whitespace cleanup, punctuation spacing, and a final sentence mark when necessary. It does not guess comma positions.

This patch adds an authenticated `POST /postprocess/punctuation` endpoint used by the Post-processing page. It runs AI4Bharat Cadence-Fast to predict punctuation for Tamil text. The result is returned for preview and only replaces the working transcript when the user applies it.

## Install the optional model dependency

From `C:\tamil_speech_to_text` in the activated virtual environment:

```powershell
python -m pip install -r requirements-punctuation.txt
```

Restart FastAPI. The model weights are downloaded on the first AI punctuation request and cached under `models/punctuation/cadence-fast/`. The first use therefore needs an internet connection and may take longer than subsequent uses. The model runs on CPU to avoid competing with the existing CPU-based IndicWhisper setup.

Start the frontend as usual:

```powershell
cd C:\tamil_speech_to_text\frontend
npm run build
npm run dev
```

## Use it

1. Transcribe audio and open the Post-processing step.
2. Leave **AI punctuation restoration** selected and click **Apply selected refinements**.
3. Review the original and refined text side by side.
4. If the model is unavailable, use the error message to install the optional dependency, or turn off AI punctuation and use basic cleanup.
5. Generate the document only after reviewing the refined text.

The endpoint checks that the recognized lexical token sequence is unchanged. If the punctuation model appears to change words, its output is rejected and the original text stays in place. This guard is not a guarantee of perfect punctuation: commas and sentence boundaries are predictions, so the user should review the transcript before using it in an official document.

## Tests

From the project root:

```powershell
python -m unittest test_tamil_postprocessing -v
python -m py_compile api.py test_api.py postprocessing\tamil_text.py
```

Model reference: [AI4Bharat/Cadence-Fast](https://huggingface.co/ai4bharat/Cadence-Fast). Its model card lists Tamil among supported languages and punctuation-restoration as the task. The model is optional; it is not downloaded with the IndicWhisper model automatically.
