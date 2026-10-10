import json
import sys
from pathlib import Path

import requests


API_URL = "http://127.0.0.1:8000"

audio_path = (
    Path(__file__).resolve().parent
    / "data"
    / "audio"
    / "test_tamil.ogg"
)


def main():
    print("=" * 60)
    print("Testing Tamil Speech-to-Text API")
    print("=" * 60)

    print("\nChecking API health...")

    response = requests.get(
        f"{API_URL}/health",
        timeout=10,
    )

    print("Status code:", response.status_code)
    print("Response:", response.json())

    if response.status_code != 200:
        print("Health check failed.")
        sys.exit(1)

    if not audio_path.exists():
        print("\nAudio file not found:")
        print(audio_path)
        print(
            "\nPlace your test audio at "
            "data\\audio\\test_tamil.ogg"
        )
        sys.exit(1)

    print("\nSending audio:")
    print(audio_path)

    with audio_path.open("rb") as audio_file:
        response = requests.post(
            f"{API_URL}/transcribe",
            files={
                "file": (
                    audio_path.name,
                    audio_file,
                    "audio/ogg",
                )
            },
            timeout=1800,
        )

    print("\nStatus code:", response.status_code)

    if response.status_code != 200:
        print(response.text)
        sys.exit(1)

    result = response.json()

    print("\nAPI result:")
    print(json.dumps(
        result,
        ensure_ascii=False,
        indent=2,
    ))

    print("\nAPI test completed successfully.")


if __name__ == "__main__":
    main()
