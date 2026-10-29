"""Authenticated smoke test for the local TamilTranscribe API."""

import getpass
import json
import os
import sys
import time
from pathlib import Path

import requests

API_BASE_URL = os.getenv("TAMILTRANSCRIBE_API_URL", "http://127.0.0.1:8000").rstrip("/")
AUDIO_PATH = Path(__file__).resolve().parent / "data" / "audio" / "test_tamil.ogg"
REQUEST_TIMEOUT = 30
PROGRESS_POLL_SECONDS = 0.55
MAX_TRANSCRIPTION_SECONDS = 45 * 60


def response_detail(response: requests.Response) -> str:
    try:
        payload = response.json()
        if isinstance(payload, dict):
            return str(payload.get("detail") or payload.get("message") or payload)
        return str(payload)
    except ValueError:
        return response.text[:1000] or f"HTTP {response.status_code}"


def main() -> int:
    print("=" * 60)
    print("Testing Tamil Speech-to-Text API")
    print("=" * 60)

    print("\nChecking API health...")
    try:
        health_response = requests.get(f"{API_BASE_URL}/health", timeout=15)
    except requests.RequestException as exc:
        print(f"Could not reach the API at {API_BASE_URL}: {exc}")
        print("Start the FastAPI backend and run this script again.")
        return 1

    print(f"Status code: {health_response.status_code}")
    try:
        health = health_response.json()
    except ValueError:
        print(health_response.text[:1000])
        return 1
    print(f"Response: {health}")
    if health_response.status_code != 200 or health.get("model_loaded") is not True:
        print("The API or IndicWhisper model is not ready.")
        return 1

    if not AUDIO_PATH.is_file():
        print(f"\nTest audio file not found: {AUDIO_PATH}")
        print("Place the test recording at that path or update AUDIO_PATH in test_api.py.")
        return 1

    # Environment variables are useful for automation; interactive prompts avoid
    # hardcoding credentials in the repository or printing the password.
    email = os.getenv("TAMILTRANSCRIBE_TEST_EMAIL", "").strip()
    password = os.getenv("TAMILTRANSCRIBE_TEST_PASSWORD", "")
    if not email:
        email = input("Workspace account email: ").strip()
    if not password:
        password = getpass.getpass("Workspace account password: ")
    if not email or not password:
        print("An email and password are required to test the protected transcription endpoint.")
        return 1

    print("\nSigning in...")
    try:
        login_response = requests.post(
            f"{API_BASE_URL}/auth/login",
            json={"email": email, "password": password, "remember_me": False},
            timeout=20,
        )
    except requests.RequestException as exc:
        print(f"Sign-in request failed: {exc}")
        return 1

    if login_response.status_code != 200:
        print(f"Sign-in failed ({login_response.status_code}): {response_detail(login_response)}")
        print("Create an account in the UI first, or check the email and password.")
        return 1

    try:
        token = login_response.json()["access_token"]
    except (ValueError, KeyError, TypeError):
        print("Sign-in returned an invalid response.")
        return 1
    headers = {"Authorization": f"Bearer {token}"}

    print("\nUploading audio and starting a progress-tracked transcription:")
    print(AUDIO_PATH)
    try:
        with AUDIO_PATH.open("rb") as audio_file:
            start_response = requests.post(
                f"{API_BASE_URL}/transcribe/start",
                headers=headers,
                files={"file": (AUDIO_PATH.name, audio_file, "audio/ogg")},
                timeout=(15, 600),
            )
    except requests.RequestException as exc:
        print(f"Transcription request failed: {exc}")
        return 1

    print(f"Job submission status: {start_response.status_code}")
    if start_response.status_code != 202:
        print(f"API error: {response_detail(start_response)}")
        return 1

    try:
        job_id = start_response.json()["job_id"]
    except (ValueError, KeyError, TypeError):
        print("The API did not return a valid transcription job ID.")
        return 1

    print(f"Job ID: {job_id}")
    started_at = time.monotonic()
    last_display = None
    result = None

    while time.monotonic() - started_at < MAX_TRANSCRIPTION_SECONDS:
        try:
            progress_response = requests.get(
                f"{API_BASE_URL}/transcribe/progress/{job_id}",
                headers=headers,
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            print(f"\nProgress request failed: {exc}")
            return 1

        if progress_response.status_code != 200:
            print(f"\nProgress API error: {response_detail(progress_response)}")
            return 1

        try:
            job = progress_response.json()
        except ValueError:
            print("\nThe progress API returned invalid JSON.")
            return 1

        display = (job.get("progress"), job.get("stage"), job.get("message"))
        if display != last_display:
            percent = int(job.get("progress", 0))
            stage = str(job.get("stage", "processing"))
            message = str(job.get("message", "Processing audio"))
            print(f"Progress: {percent:3d}% | {stage} | {message}")
            last_display = display

        if job.get("status") == "failed" or job.get("stage") == "failed":
            print(f"Transcription failed: {job.get('error') or job.get('message')}")
            return 1

        if job.get("status") == "completed" or job.get("stage") == "completed":
            result = job.get("result")
            break

        time.sleep(PROGRESS_POLL_SECONDS)

    if not result:
        print("Transcription timed out. Check the backend terminal for details.")
        return 1

    print("\nAPI result:")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("\nProgress-tracked API test completed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
