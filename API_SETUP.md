# TamilTranscribe — Local Setup Guide

This guide explains how to run the TamilTranscribe React frontend and FastAPI backend locally on Windows.

## Prerequisites

- Windows 10 or Windows 11
- Python and pip
- Node.js and npm
- Local IndicWhisper Tamil model files
- Microsoft Word desktop for the current PDF conversion method

## 1. Install backend dependencies

Open PowerShell and navigate to the project root: `C:\tamil_speech_to_text`.

Activate the existing virtual environment with `.\venv\Scripts\Activate.ps1`, then run `python -m pip install -r requirements.txt` and `python -m pip install -r requirements-api.txt`.

For a new installation, create the virtual environment first with `python -m venv venv`.

## 2. Configure the model

Place the IndicWhisper Tamil model files in the directory configured by `MODEL_PATH` in `api.py`.

The expected directory in the current setup is `models/indicwhisper/tamil/tamil_models/whisper-medium-ta_alldata_multigpu/`.

The directory must contain the model configuration, tokenizer files and model weights.

## 3. Start the backend

From the project root, activate the virtual environment and run `python -m uvicorn api:app --host 127.0.0.1 --port 8000`.

Keep this terminal open while using the application.

- Health check: http://127.0.0.1:8000/health
- Interactive API documentation: http://127.0.0.1:8000/docs

## 4. Start the frontend

Open a second PowerShell terminal and run `cd C:\tamil_speech_to_text\frontend`, followed by `npm ci` and `npm run dev`.

Open the local URL printed by Vite. Keep the frontend and backend running.

To create a production frontend build, run `npm run build` inside the frontend directory.

## 5. Test the API

With the backend running, open another terminal, navigate to `C:\tamil_speech_to_text`, activate the virtual environment, and run `python test_api.py`.

The test requires the audio file configured in `test_api.py` to exist locally.

## Main API endpoints

- `GET /` — service status
- `GET /health` — backend and model health
- `POST /transcribe` — transcribe an uploaded audio file
- `POST /generate/docx` — generate an editable Word document
- `POST /generate/pdf` — generate a PDF
- `GET /documents` — list generated documents, when available in the running backend

Visit `/docs` for the exact request parameters and response formats.

## Local data and limitations

Keep model weights, recordings, generated documents and the SQLite transcription history out of the Git repository.

PDF generation currently uses Microsoft Word desktop through `docx2pdf` on Windows. The tested inference configuration uses the CPU.

This is a local prototype. Do not expose the API publicly without suitable authentication, upload limits, privacy protections and production safeguards.
