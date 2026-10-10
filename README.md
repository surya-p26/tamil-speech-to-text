# TamilTranscribe — Automated Tamil Speech-to-Text for Government Documents

TamilTranscribe is a Windows-based prototype that converts Tamil audio recordings into editable Tamil text and helps users generate PDF and DOCX documents. It combines a React frontend, a FastAPI backend, the IndicWhisper Tamil speech-recognition model, and SQLite-backed transcription history.

> **Project status:** Local prototype. The IndicWhisper model files are stored separately from source code and must be placed in the expected local path. PDF generation uses Microsoft Word through `docx2pdf` on Windows.

## Features

- Upload Tamil audio in WAV, MP3, OGG, M4A, or FLAC formats.
- Preview and play the selected audio in the browser.
- Preprocess audio to mono, 16 kHz and normalize amplitude.
- Transcribe Tamil speech with a locally stored IndicWhisper model.
- Review and edit the generated Tamil transcript.
- Generate and download editable DOCX and PDF documents.
- Store transcription records in a local SQLite database and browse transcription history.
- List and download generated documents from the Documents page.
- Display the initial Kathbath subset evaluation results in the Evaluation page.

## Technology stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4
- **Backend:** Python, FastAPI, Uvicorn
- **Speech recognition:** PyTorch, Hugging Face Transformers, IndicWhisper Tamil
- **Audio processing:** Librosa, SoundFile
- **History:** SQLite
- **DOCX generation:** `python-docx`
- **PDF conversion:** `docx2pdf` using Microsoft Word desktop on Windows
- **Evaluation:** Word Error Rate (WER) and Character Error Rate (CER), calculated with JiWER

## Architecture

```text
User / Browser
      |
      v
React + TypeScript frontend (frontend/)
      |
      | HTTP API requests
      v
FastAPI backend (api.py)
      |
      +--> Audio preprocessing (mono, 16 kHz, normalization)
      |
      +--> IndicWhisper Tamil --> Tamil transcript
      |                           |
      |                           +--> Editor / post-processing UI
      |
      +--> SQLite transcription history
      |
      +--> DOCX generator --> Word-based PDF conversion
      |
      +--> Documents listing and downloads
```

## Project structure

```text
C:\tamil_speech_to_text\
├── api.py                         # FastAPI endpoints
├── app.py                         # Existing Python app / pipeline entrypoint
├── requirements.txt               # Core Python dependencies
├── requirements-api.txt           # API-specific dependencies
├── run_api.bat                    # Windows API startup helper
├── test_api.py                    # API smoke test
├── API_SETUP.md                   # API setup notes
├── README.md                      # This file
├── .gitignore
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── index.css
│   │   └── main.tsx
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts
│   └── index.html
├── models/                        # Local model weights; not committed to Git
├── data/                          # Local audio, output files and SQLite database
├── preprocessing/
├── transcription/
├── postprocessing/
├── evaluation/
└── document/
```

Runtime-created files are kept locally under `data/`. The actual database filename is created/configured by the backend version installed in your project; do not delete it if you want to preserve history.

## Requirements

- Windows 10 or Windows 11
- Python and pip
- Node.js and npm
- Microsoft Word desktop installed if using the current `docx2pdf` PDF-conversion endpoint
- Local IndicWhisper Tamil model files

The current development setup has been tested on a Windows PC with CPU inference. GPU acceleration is not currently configured.

## 1. Set up the IndicWhisper model

Model weights are large and are deliberately excluded from the Git repository. Obtain the model files from the project’s referenced AI4Bharat/IndicWhisper distribution and extract them to the path expected by `api.py`:

```text
models/indicwhisper/tamil/tamil_models/whisper-medium-ta_alldata_multigpu/
```

The model directory must include its configuration, tokenizer files, and model weights (including `pytorch_model.bin`). Keep the folder name and layout consistent with `MODEL_PATH` in `api.py`.

## 2. Set up the backend

Open PowerShell:

```powershell
cd C:\tamil_speech_to_text
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install -r requirements-api.txt
```

If the current PDF endpoint uses `docx2pdf` and it is not listed in your dependency file, install it in the activated environment:

```powershell
python -m pip install docx2pdf
```

**PDF prerequisite:** `docx2pdf` uses Microsoft Word desktop on Windows. Word must be installed and able to open DOCX files for server-side PDF conversion to work.

Start FastAPI:

```powershell
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Keep this terminal open. Check the health endpoint in your browser:

```text
http://127.0.0.1:8000/health
```

The API should report that the service is healthy and the model is loaded. If model loading fails, verify the local `MODEL_PATH` and the presence of model weights.

## 3. Set up and run the frontend

Open a second PowerShell window:

```powershell
cd C:\tamil_speech_to_text\frontend
npm ci
npm run dev
```

Open the local URL printed by Vite (for example, `http://localhost:8443/` or `http://localhost:5173/`). Keep the frontend terminal running as well as FastAPI.

Create a production build with:

```powershell
npm run build
```

The current frontend builds successfully in the local environment. Vite may display configuration-loader warnings related to the Figma Make Vite configuration; those warnings did not prevent the observed build from completing.

## 4. Test the API

With the backend running, open another terminal:

```powershell
cd C:\tamil_speech_to_text
.\venv\Scripts\Activate.ps1
python test_api.py
```

The test checks the API health endpoint and sends the configured test audio file to the transcription endpoint. Adjust the test audio path in `test_api.py` if that file is not present on your machine.

## API overview

The current backend provides endpoints used by the frontend, including:

- `GET /` and `GET /health` — service status
- `POST /transcribe` — upload an audio file and receive the Tamil transcription as JSON
- `POST /generate/docx` — generate a DOCX from supplied document text
- `POST /generate/pdf` — generate a PDF from supplied document text using the current PDF-conversion method
- `GET /documents` — list available generated documents, if present in the installed backend version

Open `http://127.0.0.1:8000/docs` while FastAPI is running to inspect the OpenAPI documentation for the exact endpoints supported by your installed backend.

## Evaluation results

The IndicWhisper model was evaluated on an **initial five-sample subset** of the Tamil Kathbath validation split:

- **Overall WER:** 9.8%
- **Overall CER:** 1.6%
- **Number of samples:** 5

These are preliminary results from a small subset. They should not be represented as full-dataset performance or as a guaranteed accuracy for every uploaded recording. A larger and more varied evaluation is needed for a stronger performance claim.

## Git and data safety

Before publishing to GitHub:

- Do **not** commit `venv/`, `node_modules/`, `frontend/dist/`, or Python caches.
- Do **not** commit the large `models/` directory; document how to obtain the model separately.
- Do **not** commit personal or sensitive recordings, generated documents, local outputs, or the SQLite database.
- Never commit passwords, API keys, `.env` files, or other secrets.
- Review `git status --short` and `git status --ignored` before making the first commit.

The supplied root `.gitignore` is intended to exclude these local-only items. Check it against your actual runtime paths before publishing.

## Known limitations

- The current tested inference configuration uses the CPU; Intel Iris Xe GPU acceleration has been postponed.
- Recognition quality depends on speaking style, pronunciation, noise, recording quality and the content of the audio.
- The evaluation currently represents only five samples from the Tamil Kathbath validation split.
- The current PDF conversion path depends on Microsoft Word desktop being installed on the Windows machine running the backend.
- This is a local prototype, not a hardened production deployment. Do not expose the API to the public internet without adding authentication, authorization, upload limits, privacy controls, and production deployment safeguards.

## Future improvements

- Evaluate on a larger and more diverse Tamil audio set.
- Investigate Tamil government-domain vocabulary adaptation and additional text post-processing.
- Explore compatible CPU optimization or Intel GPU acceleration.
- Improve error handling and add automated tests for upload, transcription, history, and document downloads.
- Consider a secure deployment design for multiple authorized users.

## License

No license has been specified yet. Add a license only after deciding how the source code and any third-party model components may be reused. The model's license and usage terms should be checked separately from the project's code license.
