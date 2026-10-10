@echo off
title Tamil Speech-to-Text API

cd /d C:\tamil_speech_to_text

echo ============================================
echo Starting Tamil Speech-to-Text API
echo ============================================
echo.

call venv\Scripts\activate

echo Python:
python --version

echo.
echo Starting FastAPI on http://127.0.0.1:8000
echo Press CTRL+C to stop the server.
echo.

python -m uvicorn api:app --host 127.0.0.1 --port 8000

pause
