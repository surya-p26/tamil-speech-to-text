# TamilTranscribe — Real Transcription Progress Update

This patch replaces the decorative fixed-width line on the Transcription page with a progress indicator connected to real upload and backend processing events.

## What changed

- The browser reports actual upload-byte progress while the audio file is being sent.
- FastAPI now accepts a progress-tracked job at `POST /transcribe/start` and reports its owner-scoped status at `GET /transcribe/progress/{job_id}`.
- The page polls the job endpoint and displays the current step: upload, preprocessing, transcription, saving, or completion.
- Longer recordings are processed in 25-second audio windows with a 2-second overlap; progress advances as each window finishes.
- Short recordings continue to use one model inference pass to preserve context. Because that inference is atomic, the active part of the bar shows a moving indicator while the model is running instead of inventing a token-by-token percentage.
- The UI reaches 100% only after the transcript has been saved to history and the completed result is ready.
- The original synchronous `POST /transcribe` endpoint remains available for compatibility.
- `test_api.py` now tests the same progress-tracked flow used by the frontend.

Progress jobs are held in memory for this local, single-process app. If the backend is restarted while a job is running, its in-memory progress state is lost; saved transcription records remain in SQLite.

## Apply the update on Windows

1. Stop FastAPI and Vite by pressing `Ctrl+C` in each terminal.
2. Back up the files currently in your project: `api.py`, `test_api.py`, `frontend/src/App.tsx`, `frontend/src/api.ts`, and `frontend/src/index.css`.
3. Extract this ZIP into `C:\tamil_speech_to_text` and allow the five matching files to be replaced. The new guide is added at the project root.
4. In PowerShell, run:

   ```powershell
   cd C:\tamil_speech_to_text
   .\venv\Scripts\Activate.ps1
   python -m py_compile api.py test_api.py
   ```

5. Restart the backend. Keep the CORS environment variable you already use for your frontend origin. For example, replace/add the LAN origin if your local address changes:

   ```powershell
   $env:TAMILTRANSCRIBE_CORS_ORIGINS = "http://10.10.69.52:8443,http://localhost:8443,http://127.0.0.1:8443,http://localhost:5173,http://127.0.0.1:5173"
   python -m uvicorn api:app --host 127.0.0.1 --port 8000
   ```

6. In a second terminal, rebuild and start the frontend:

   ```powershell
   cd C:\tamil_speech_to_text\frontend
   npm run build
   npm run dev
   ```

7. Upload a Tamil audio file and watch the progress line. For a short clip, the percentage may pause while IndicWhisper is working; the animated active segment indicates the model is still processing. For longer audio, progress advances after each completed audio window.
8. Run `python test_api.py` with the backend running to test authenticated upload, job polling, and the final response. The script prompts for your account credentials; it does not store them.

No new frontend npm dependencies are required.
