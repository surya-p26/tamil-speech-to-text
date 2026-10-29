"""TamilTranscribe entrypoint.

Runs the FastAPI server using Uvicorn when executed directly.
"""
import sys
import uvicorn

if __name__ == "__main__":
    host = "127.0.0.1"
    port = 8000
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    print(f"Starting TamilTranscribe API on http://{host}:{port} ...")
    uvicorn.run("api:app", host=host, port=port, reload=True)
