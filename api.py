import os
import re
import shutil
import sqlite3
import unicodedata
import uuid
from contextlib import closing
from datetime import datetime
from pathlib import Path

import librosa
import soundfile as sf
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from transformers import pipeline

from document.docx_generator import generate_docx
from postprocessing.tamil_text import clean_tamil_text


# ============================================================
# SETTINGS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent

MODEL_PATH = (
    PROJECT_ROOT
    / "models"
    / "indicwhisper"
    / "tamil"
    / "tamil_models"
    / "whisper-medium-ta_alldata_multigpu"
)

UPLOAD_DIR = PROJECT_ROOT / "data" / "audio" / "api_uploads"
PROCESSED_DIR = PROJECT_ROOT / "data" / "audio" / "api_processed"
OUTPUT_DIR = PROJECT_ROOT / "data" / "audio" / "api_outputs"
DATABASE_PATH = PROJECT_ROOT / "data" / "transcription_history.sqlite3"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)


# ============================================================
# SQLITE TRANSCRIPTION HISTORY
# ============================================================

def _now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _connect_history():
    connection = sqlite3.connect(DATABASE_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    return connection


def init_history_database() -> None:
    with closing(_connect_history()) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS transcriptions (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Completed',
                transcription TEXT NOT NULL,
                raw_text TEXT NOT NULL,
                model TEXT NOT NULL,
                device TEXT NOT NULL,
                sample_rate INTEGER NOT NULL,
                channels INTEGER NOT NULL,
                audio_duration_seconds REAL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS generated_documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                source_filename TEXT NOT NULL DEFAULT '',
                format TEXT NOT NULL,
                created_at TEXT NOT NULL,
                size_bytes INTEGER NOT NULL
            )
            """
        )
        connection.commit()


def _history_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "filename": row["filename"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "status": row["status"],
        "transcription": row["transcription"],
        "raw_text": row["raw_text"],
        "model": row["model"],
        "device": row["device"],
        "sample_rate": row["sample_rate"],
        "channels": row["channels"],
        "audio_duration_seconds": row["audio_duration_seconds"],
    }


def _create_history_record(
    *, filename: str, transcription: str, raw_text: str, audio_duration_seconds: float
) -> dict:
    record_id = uuid.uuid4().hex
    now = _now_iso()
    with closing(_connect_history()) as connection:
        connection.execute(
            """
            INSERT INTO transcriptions (
                id, filename, created_at, updated_at, status, transcription, raw_text,
                model, device, sample_rate, channels, audio_duration_seconds
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record_id, filename, now, now, "Completed", transcription, raw_text,
                "IndicWhisper Tamil", device, 16000, 1, float(audio_duration_seconds),
            ),
        )
        connection.commit()
        row = connection.execute(
            "SELECT * FROM transcriptions WHERE id = ?", (record_id,)
        ).fetchone()
    return _history_row_to_dict(row)


def _get_history_record(record_id: str):
    with closing(_connect_history()) as connection:
        row = connection.execute(
            "SELECT * FROM transcriptions WHERE id = ?", (record_id,)
        ).fetchone()
    return _history_row_to_dict(row) if row else None


init_history_database()


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="Tamil Speech-to-Text API",
    description="Backend API for Tamil speech transcription using IndicWhisper",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

# Development configuration for the React UI.
# Restrict this to your exact frontend origin later for production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MODEL
# ============================================================

if not MODEL_PATH.exists():
    raise RuntimeError(
        "IndicWhisper model not found at:\n"
        f"{MODEL_PATH}\n\n"
        "Make sure api.py is placed in the root of your "
        "C:\\tamil_speech_to_text project."
    )

print("=" * 60)
print("Tamil Speech-to-Text API")
print("=" * 60)

device = "cuda" if torch.cuda.is_available() else "cpu"

print("Project root:", PROJECT_ROOT)
print("Model path:", MODEL_PATH)
print("Device:", device)
print("\nLoading IndicWhisper...")

asr = pipeline(
    "automatic-speech-recognition",
    model=str(MODEL_PATH),
    device=device,
)

print("IndicWhisper loaded successfully.")
print("=" * 60)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
def root():
    return {
        "status": "running",
        "message": "Tamil Speech-to-Text API is running",
        "model": "IndicWhisper Tamil",
        "device": device,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": True,
        "model": "IndicWhisper Tamil",
        "device": device,
    }


# ============================================================
# AUDIO PREPROCESSING
# ============================================================

def preprocess_audio(input_file: Path, output_file: Path) -> float:
    """Convert audio to mono 16 kHz WAV and normalize amplitude."""

    print("Preprocessing audio...")
    print("Input:", input_file)

    audio, sample_rate = librosa.load(
        str(input_file),
        sr=16000,
        mono=True,
    )

    max_value = max(abs(audio), default=0)

    if max_value > 0:
        audio = audio / max_value

    sf.write(
        str(output_file),
        audio,
        16000,
    )

    print("Audio converted to 16 kHz mono.")
    print("Processed:", output_file)
    return float(len(audio) / 16000.0)


# ============================================================
# TRANSCRIPTION
# ============================================================

def transcribe_processed_audio(audio_file: Path) -> tuple[str, str]:
    """Run IndicWhisper and return raw + cleaned Tamil text."""

    print("Transcribing with IndicWhisper...")

    result = asr(
        str(audio_file),
        generate_kwargs={
            "language": "ta",
            "task": "transcribe",
        },
    )

    raw_text = result["text"].strip()
    final_text = clean_tamil_text(raw_text)

    return raw_text, final_text


# ============================================================
# TRANSCRIBE ENDPOINT
# ============================================================

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Upload Tamil audio and return the final transcription."""

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file name provided.",
        )

    allowed_extensions = {
        ".wav",
        ".mp3",
        ".ogg",
        ".flac",
        ".m4a",
    }

    extension = Path(file.filename).suffix.lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported audio format. "
                "Supported formats: WAV, MP3, OGG, FLAC, M4A."
            ),
        )

    file_id = uuid.uuid4().hex

    input_file = UPLOAD_DIR / f"{file_id}{extension}"
    processed_file = PROCESSED_DIR / f"{file_id}_16k.wav"

    try:
        # ----------------------------------------------------
        # Save upload
        # ----------------------------------------------------

        with input_file.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        print("\n" + "=" * 60)
        print("NEW TRANSCRIPTION REQUEST")
        print("=" * 60)
        print("Original file:", file.filename)

        # ----------------------------------------------------
        # Preprocess
        # ----------------------------------------------------

        audio_duration_seconds = preprocess_audio(
            input_file,
            processed_file,
        )

        # ----------------------------------------------------
        # Transcribe
        # ----------------------------------------------------

        raw_text, final_text = transcribe_processed_audio(
            processed_file
        )

        print("\nRaw text:")
        print(raw_text)

        print("\nFinal text:")
        print(final_text)

        # ----------------------------------------------------
        # Persist successful transcription for Recent / History
        # ----------------------------------------------------

        record = _create_history_record(
            filename=file.filename,
            transcription=final_text,
            raw_text=raw_text,
            audio_duration_seconds=audio_duration_seconds,
        )

        # ----------------------------------------------------
        # Response
        # ----------------------------------------------------

        return {
            "success": True,
            "id": record["id"],
            "created_at": record["created_at"],
            "audio_duration_seconds": record["audio_duration_seconds"],
            "filename": file.filename,
            "model": "IndicWhisper Tamil",
            "device": device,
            "sample_rate": 16000,
            "channels": 1,
            "raw_text": raw_text,
            "transcription": final_text,
        }

    except Exception as exc:
        print("\nERROR during transcription:")
        print(exc)

        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {exc}",
        ) from exc

    finally:
        # ----------------------------------------------------
        # Cleanup temporary files
        # ----------------------------------------------------

        for path in (input_file, processed_file):
            try:
                if path.exists():
                    path.unlink()
            except OSError:
                pass


# ============================================================
# TRANSCRIPTION HISTORY API
# ============================================================

@app.get("/history")
def list_transcription_history():
    """Return real, locally saved transcription records, newest first."""
    with closing(_connect_history()) as connection:
        rows = connection.execute(
            "SELECT * FROM transcriptions ORDER BY created_at DESC, rowid DESC"
        ).fetchall()
    return {"records": [_history_row_to_dict(row) for row in rows]}


@app.get("/history/{record_id}")
def get_transcription_history(record_id: str):
    record = _get_history_record(record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Transcription record not found.")
    return record


@app.put("/history/{record_id}")
def update_transcription_history(record_id: str, payload: dict):
    """Save edits made in the transcript editor / post-processing screens."""
    transcription = payload.get("transcription")
    if not isinstance(transcription, str) or not transcription.strip():
        raise HTTPException(
            status_code=400,
            detail="A non-empty 'transcription' field is required.",
        )

    now = _now_iso()
    with closing(_connect_history()) as connection:
        cursor = connection.execute(
            "UPDATE transcriptions SET transcription = ?, updated_at = ? WHERE id = ?",
            (transcription.strip(), now, record_id),
        )
        connection.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Transcription record not found.")
        row = connection.execute(
            "SELECT * FROM transcriptions WHERE id = ?", (record_id,)
        ).fetchone()
    return _history_row_to_dict(row)


# ============================================================
# GENERATED DOCUMENT LIBRARY
# ============================================================


def _safe_document_stem(title: str | None, fallback: str = "TamilTranscribe") -> str:
    """Return a safe, readable filename stem while preserving Tamil characters."""
    candidate = unicodedata.normalize("NFC", (title or "").strip())
    candidate = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", candidate)
    candidate = re.sub(r"\s+", "_", candidate).strip(" ._-")
    candidate = candidate[:70].rstrip(" ._-")
    return candidate or fallback


def save_output_text(text: str, prefix: str, title: str | None = None) -> str:
    """Create a unique, human-readable filename stem for generated files."""
    stem = _safe_document_stem(title, prefix)
    timestamp = datetime.now().astimezone().strftime("%Y%m%d_%H%M%S")
    return f"{stem}_{timestamp}_{uuid.uuid4().hex[:6]}"


def _register_generated_document(
    path: Path,
    *,
    title: str,
    source_filename: str = "",
    file_format: str,
) -> None:
    """Persist metadata so the Documents page can list real generated files."""
    now = _now_iso()
    document_id = uuid.uuid4().hex
    with closing(_connect_history()) as connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO generated_documents
                (id, filename, title, source_filename, format, created_at, size_bytes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                document_id,
                path.name,
                title.strip() or path.stem,
                source_filename.strip(),
                file_format.upper(),
                now,
                path.stat().st_size,
            ),
        )
        connection.commit()


def _document_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "filename": row["filename"],
        "title": row["title"],
        "source_filename": row["source_filename"],
        "format": row["format"],
        "created_at": row["created_at"],
        "size_bytes": row["size_bytes"],
    }


@app.get("/documents")
def list_generated_documents():
    """List real files in api_outputs, including files generated before this update."""
    registered: list[dict] = []
    seen: set[str] = set()
    with closing(_connect_history()) as connection:
        rows = connection.execute(
            "SELECT * FROM generated_documents ORDER BY created_at DESC, rowid DESC"
        ).fetchall()
    for row in rows:
        item = _document_row_to_dict(row)
        path = OUTPUT_DIR / item["filename"]
        if path.is_file() and path.parent.resolve() == OUTPUT_DIR.resolve():
            item["size_bytes"] = path.stat().st_size
            registered.append(item)
            seen.add(item["filename"])

    # Include earlier generated files that predate the metadata table.
    for path in OUTPUT_DIR.iterdir():
        if not path.is_file() or path.suffix.lower() not in {".pdf", ".docx"}:
            continue
        if path.name.endswith("_source.docx") or path.name in seen:
            continue
        created = datetime.fromtimestamp(path.stat().st_mtime).astimezone().isoformat(timespec="seconds")
        registered.append({
            "id": path.name,
            "filename": path.name,
            "title": path.stem.replace("_", " "),
            "source_filename": "",
            "format": path.suffix[1:].upper(),
            "created_at": created,
            "size_bytes": path.stat().st_size,
        })

    registered.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    return {"documents": registered}


@app.get("/documents/{filename}")
def download_generated_document(filename: str):
    """Download one generated PDF/DOCX without exposing arbitrary filesystem paths."""
    if Path(filename).name != filename or filename in {".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid document filename.")

    path = (OUTPUT_DIR / filename).resolve()
    if path.parent != OUTPUT_DIR.resolve() or path.suffix.lower() not in {".pdf", ".docx"}:
        raise HTTPException(status_code=400, detail="Invalid document path or file type.")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Generated document not found.")

    media_type = (
        "application/pdf" if path.suffix.lower() == ".pdf"
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    return FileResponse(path=str(path), media_type=media_type, filename=path.name)


# ============================================================
# DOCUMENT GENERATION
# ============================================================

@app.post("/generate/pdf")
async def generate_pdf_endpoint(payload: dict):
    """Generate a Tamil DOCX, convert it using Word, and register the resulting PDF."""
    text = payload.get("text")
    title = payload.get("title") or "Tamil transcription"
    source_filename = payload.get("source_filename") or ""

    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=400, detail="A non-empty 'text' field is required.")
    if not isinstance(title, str) or not isinstance(source_filename, str):
        raise HTTPException(status_code=400, detail="Document metadata must be text values.")

    output_name = save_output_text(text, "tamil_transcription", title)
    temporary_docx = OUTPUT_DIR / f"{output_name}_source.docx"
    output_file = OUTPUT_DIR / f"{output_name}.pdf"

    try:
        success = generate_docx(text.strip(), str(temporary_docx))
        if not success or not temporary_docx.exists():
            raise RuntimeError("Could not create the intermediate DOCX for PDF conversion.")

        try:
            from docx2pdf import convert
        except ImportError as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    "PDF conversion requires docx2pdf and Microsoft Word desktop. "
                    "Install it in the active venv with: python -m pip install docx2pdf"
                ),
            ) from exc

        convert(str(temporary_docx), str(output_file))
        if not output_file.exists() or output_file.stat().st_size == 0:
            raise RuntimeError(
                "Microsoft Word did not create the PDF. Confirm Microsoft Word desktop is installed."
            )

        _register_generated_document(
            output_file, title=title, source_filename=source_filename, file_format="PDF"
        )
        return FileResponse(path=str(output_file), media_type="application/pdf", filename=output_file.name)

    except HTTPException:
        raise
    except Exception as exc:
        print("\nERROR converting DOCX to PDF:")
        print(exc)
        raise HTTPException(
            status_code=500,
            detail=f"DOCX-to-PDF conversion failed. Confirm Microsoft Word is installed. Details: {exc}",
        ) from exc
    finally:
        try:
            if temporary_docx.exists():
                temporary_docx.unlink()
        except OSError:
            pass


@app.post("/generate/docx")
async def generate_docx_endpoint(payload: dict):
    """Generate and register an editable DOCX document."""
    text = payload.get("text")
    title = payload.get("title") or "Tamil transcription"
    source_filename = payload.get("source_filename") or ""

    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=400, detail="A non-empty 'text' field is required.")
    if not isinstance(title, str) or not isinstance(source_filename, str):
        raise HTTPException(status_code=400, detail="Document metadata must be text values.")

    output_name = save_output_text(text, "tamil_transcription", title)
    output_file = OUTPUT_DIR / f"{output_name}.docx"

    try:
        success = generate_docx(text.strip(), str(output_file))
        if not success or not output_file.exists():
            raise RuntimeError("DOCX generation failed.")

        _register_generated_document(
            output_file, title=title, source_filename=source_filename, file_format="DOCX"
        )
        return FileResponse(
            path=str(output_file),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=output_file.name,
        )
    except Exception as exc:
        print("\nERROR generating DOCX:")
        print(exc)
        raise HTTPException(status_code=500, detail=f"DOCX generation failed: {exc}") from exc
