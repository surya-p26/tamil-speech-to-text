import hashlib
import hmac
import os
import re
import secrets
import shutil
import smtplib
import sqlite3
import ssl
import threading
import time
import unicodedata
import uuid
from contextlib import closing
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path

from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

import librosa
import soundfile as sf
import torch
from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from document_service import generate_tamil_pdf
from starlette.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from transformers import pipeline

from document.docx_generator import generate_docx
from postprocessing.tamil_text import (
    PunctuationModelUnavailable,
    clean_tamil_text,
    restore_tamil_punctuation,
)


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

# Progress jobs live in memory for this single-process local prototype.
# Job ownership is tied to the authenticated user's id.
_TRANSCRIPTION_JOBS: dict[str, dict] = {}
_TRANSCRIPTION_JOBS_LOCK = threading.Lock()
_ASR_LOCK = threading.Lock()
TRANSCRIPTION_CHUNK_SECONDS = 25.0
TRANSCRIPTION_CHUNK_OVERLAP_SECONDS = 2.0

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
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_history_database() -> None:
    """Create tables and safely migrate older local SQLite databases."""
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
                audio_duration_seconds REAL,
                user_id TEXT
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
                size_bytes INTEGER NOT NULL,
                user_id TEXT
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                department TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS auth_sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at REAL NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at REAL NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )

        # Add owner columns to databases created by earlier versions.
        for table in ("transcriptions", "generated_documents"):
            columns = {
                row["name"]
                for row in connection.execute(f"PRAGMA table_info({table})").fetchall()
            }
            if "user_id" not in columns:
                connection.execute(f"ALTER TABLE {table} ADD COLUMN user_id TEXT")

        connection.execute("CREATE INDEX IF NOT EXISTS idx_transcriptions_user_created ON transcriptions(user_id, created_at)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_documents_user_created ON generated_documents(user_id, created_at)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions(user_id)")
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
    *, filename: str, transcription: str, raw_text: str,
    audio_duration_seconds: float, user_id: str
) -> dict:
    record_id = uuid.uuid4().hex
    now = _now_iso()
    with closing(_connect_history()) as connection:
        connection.execute(
            """
            INSERT INTO transcriptions (
                id, filename, created_at, updated_at, status, transcription, raw_text,
                model, device, sample_rate, channels, audio_duration_seconds, user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record_id, filename, now, now, "Completed", transcription, raw_text,
                "IndicWhisper Tamil", device, 16000, 1,
                float(audio_duration_seconds), user_id,
            ),
        )
        connection.commit()
        row = connection.execute(
            "SELECT * FROM transcriptions WHERE id = ?", (record_id,)
        ).fetchone()
    return _history_row_to_dict(row)


def _get_history_record(record_id: str, user_id: str):
    with closing(_connect_history()) as connection:
        row = connection.execute(
            "SELECT * FROM transcriptions WHERE id = ? AND user_id = ?",
            (record_id, user_id),
        ).fetchone()
    return _history_row_to_dict(row) if row else None


init_history_database()


# ============================================================
# AUTHENTICATION
# ============================================================

PASSWORD_ITERATIONS = 600_000
SESSION_HOURS = 8
REMEMBERED_SESSION_DAYS = 30
RESET_TOKEN_MINUTES = 30
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
security = HTTPBearer(auto_error=False)


class RegisterPayload(BaseModel):
    full_name: str
    email: str
    department: str = "My department"
    password: str
    remember_me: bool = False


class LoginPayload(BaseModel):
    email: str
    password: str
    remember_me: bool = False

class GoogleLoginPayload(BaseModel):
    credential: str
    remember_me: bool = False

class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class PunctuationRestorePayload(BaseModel):
    text: str


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _validate_password(password: str) -> None:
    if len(password) < 10:
        raise HTTPException(status_code=400, detail="Password must contain at least 10 characters.")
    if len(password) > 256:
        raise HTTPException(status_code=400, detail="Password must be 256 characters or fewer.")


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS
    )
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt.hex()}${digest.hex()}"


def _verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt_hex, digest_hex = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
        ).hex()
        return hmac.compare_digest(actual, digest_hex)
    except (ValueError, TypeError):
        return False


def _public_user(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "department": row["department"],
        "created_at": row["created_at"],
    }


def _find_user_by_email(email: str):
    with closing(_connect_history()) as connection:
        return connection.execute(
            "SELECT * FROM users WHERE email = ? COLLATE NOCASE", (_normalize_email(email),)
        ).fetchone()


def _create_auth_session(user_id: str, remember_me: bool) -> dict:
    token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = datetime.now().astimezone()
    lifetime = (
        REMEMBERED_SESSION_DAYS * 24 * 60 * 60
        if remember_me else SESSION_HOURS * 60 * 60
    )
    expires_at = now.timestamp() + lifetime
    with closing(_connect_history()) as connection:
        connection.execute("DELETE FROM auth_sessions WHERE expires_at <= ?", (now.timestamp(),))
        connection.execute(
            "INSERT INTO auth_sessions(token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token_hash, user_id, now.isoformat(timespec="seconds"), expires_at),
        )
        connection.commit()
    row = None
    with closing(_connect_history()) as connection:
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=500, detail="Could not create the user session.")
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": lifetime,
        "user": _public_user(row),
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Please sign in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_hash = hashlib.sha256(credentials.credentials.encode("utf-8")).hexdigest()
    with closing(_connect_history()) as connection:
        row = connection.execute(
            """
            SELECT u.* FROM auth_sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1
            """,
            (token_hash, datetime.now().timestamp()),
        ).fetchone()
    if row is None:
        raise HTTPException(
            status_code=401,
            detail="Your session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _public_user(row)


def _smtp_settings() -> dict | None:
    host = os.getenv("TAMILTRANSCRIBE_SMTP_HOST", "").strip()
    username = os.getenv("TAMILTRANSCRIBE_SMTP_USER", "").strip()
    password = os.getenv("TAMILTRANSCRIBE_SMTP_PASSWORD", "")
    sender = os.getenv("TAMILTRANSCRIBE_SMTP_FROM", username).strip()
    if not all((host, username, password, sender)):
        return None
    try:
        port = int(os.getenv("TAMILTRANSCRIBE_SMTP_PORT", "587"))
    except ValueError:
        return None
    return {"host": host, "port": port, "username": username, "password": password, "sender": sender}


def _send_password_reset_email(email: str, token: str) -> None:
    config = _smtp_settings()
    if config is None:
        raise RuntimeError("SMTP settings are not configured.")

    base_url = os.getenv("TAMILTRANSCRIBE_FRONTEND_URL", "http://localhost:8443").rstrip("/")
    reset_url = f"{base_url}/?reset_token={token}"
    message = EmailMessage()
    message["Subject"] = "Reset your TamilTranscribe password"
    message["From"] = config["sender"]
    message["To"] = email
    message.set_content(
        "A password reset was requested for your TamilTranscribe account.\n\n"
        f"Use this link within {RESET_TOKEN_MINUTES} minutes:\n{reset_url}\n\n"
        "If you did not request this, you can ignore this message."
    )
    with smtplib.SMTP(config["host"], config["port"], timeout=15) as server:
        server.starttls(context=ssl.create_default_context())
        server.login(config["username"], config["password"])
        server.send_message(message)


def _claim_legacy_data_for_first_user(user_id: str) -> None:
    """Keep existing single-user local data visible to the first created account."""
    with closing(_connect_history()) as connection:
        connection.execute("UPDATE transcriptions SET user_id = ? WHERE user_id IS NULL", (user_id,))
        connection.execute("UPDATE generated_documents SET user_id = ? WHERE user_id IS NULL", (user_id,))
        known_files = {
            row["filename"]
            for row in connection.execute(
                "SELECT filename FROM generated_documents WHERE user_id = ?", (user_id,)
            ).fetchall()
        }
        connection.commit()

    # Import older output files that were created before document metadata was added.
    for path in OUTPUT_DIR.iterdir():
        if not path.is_file() or path.suffix.lower() not in {".pdf", ".docx"}:
            continue
        if path.name.endswith("_source.docx") or path.name in known_files:
            continue
        created = datetime.fromtimestamp(path.stat().st_mtime).astimezone().isoformat(timespec="seconds")
        _register_generated_document(
            path,
            title=path.stem.replace("_", " "),
            source_filename="",
            file_format=path.suffix[1:].upper(),
            user_id=user_id,
            created_at=created,
        )



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
_configured_origins = os.getenv(
    "TAMILTRANSCRIBE_CORS_ORIGINS",
    "http://localhost:8443,http://127.0.0.1:8443,http://localhost:5173,http://127.0.0.1:5173",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in _configured_origins.split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
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
# AUTH ROUTES
# ============================================================

@app.post("/auth/register")
def register(payload: RegisterPayload):
    full_name = " ".join(payload.full_name.strip().split())
    email = _normalize_email(payload.email)
    department = " ".join(payload.department.strip().split()) or "My department"
    password = payload.password

    if len(full_name) < 2 or len(full_name) > 100:
        raise HTTPException(status_code=400, detail="Enter a name between 2 and 100 characters.")
    if not EMAIL_PATTERN.fullmatch(email) or len(email) > 254:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if len(department) > 120:
        raise HTTPException(status_code=400, detail="Department name must be 120 characters or fewer.")
    _validate_password(password)

    password_hash = _hash_password(password)
    with closing(_connect_history()) as connection:
        connection.execute("BEGIN IMMEDIATE")
        user_count = connection.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
        user_id = uuid.uuid4().hex
        now = _now_iso()
        try:
            connection.execute(
                "INSERT INTO users(id, full_name, email, department, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, full_name, email, department, password_hash, now),
            )
            connection.commit()
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=409, detail="An account with this email already exists.") from exc

    # Legacy local records are claimed once by the initial account; future accounts are isolated.
    if user_count == 0:
        _claim_legacy_data_for_first_user(user_id)
    return _create_auth_session(user_id, remember_me=payload.remember_me)


@app.post("/auth/login")
def login(payload: LoginPayload):
    user = _find_user_by_email(payload.email)
    # Use the same error for unknown email and incorrect password.
    if user is None or not user["is_active"] or not _verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    return _create_auth_session(user["id"], remember_me=payload.remember_me)


@app.post("/auth/google")
def google_login(payload: GoogleLoginPayload):
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()

    if not client_id:
        raise HTTPException(
            status_code=503,
            detail="Google Sign-In is not configured on the server.",
        )

    try:
        claims = id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            client_id,
        )
    except (ValueError, GoogleAuthError):
        raise HTTPException(
            status_code=401,
            detail="Google sign-in could not be verified. Please try again.",
        )

    email = _normalize_email(claims.get("email", ""))
    google_sub = claims.get("sub")
    email_verified = claims.get("email_verified") is True
    full_name = " ".join((claims.get("name") or "").strip().split())

    if not email_verified or not google_sub or not EMAIL_PATTERN.fullmatch(email):
        raise HTTPException(
            status_code=401,
            detail="Google must provide a verified email address.",
        )

    # Reuse an account only when its email is verified by Google.
    user = _find_user_by_email(email)

    if user is not None:
        if not user["is_active"]:
            raise HTTPException(
                status_code=403,
                detail="This account is disabled.",
            )

        return _create_auth_session(
            user["id"],
            remember_me=payload.remember_me,
        )

    # Create a new account for a verified Google identity.
    if not full_name:
        full_name = email.split("@", 1)[0][:100] or "Google User"

    user_id = uuid.uuid4().hex
    now = _now_iso()
    random_password_hash = _hash_password(secrets.token_urlsafe(48))

    with closing(_connect_history()) as connection:
        connection.execute("BEGIN IMMEDIATE")
        user_count = connection.execute(
            "SELECT COUNT(*) AS count FROM users"
        ).fetchone()["count"]

        try:
            connection.execute(
                """
                INSERT INTO users
                    (id, full_name, email, department, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    full_name,
                    email,
                    "My department",
                    random_password_hash,
                    now,
                ),
            )
            connection.commit()
        except sqlite3.IntegrityError:
            connection.rollback()
            # Another request may have created the account at the same time.
            user = _find_user_by_email(email)
            if user is None or not user["is_active"]:
                raise HTTPException(
                    status_code=409,
                    detail="Could not create the Google account. Please try again.",
                )
            return _create_auth_session(
                user["id"],
                remember_me=payload.remember_me,
            )

    # Preserve your existing first-account legacy-data behavior.
    if user_count == 0:
        _claim_legacy_data_for_first_user(user_id)

    return _create_auth_session(
        user_id,
        remember_me=payload.remember_me,
    )


@app.get("/auth/me")
def current_user_profile(current_user: dict = Depends(get_current_user)):
    return current_user


@app.post("/postprocess/punctuation")
def postprocess_punctuation(
    payload: PunctuationRestorePayload,
    current_user: dict = Depends(get_current_user),
):
    """Restore Tamil punctuation without changing the recognized words."""
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Transcript text cannot be empty.")
    if len(text) > 100_000:
        raise HTTPException(status_code=413, detail="Transcript is too long to process in one request.")

    try:
        punctuated = restore_tamil_punctuation(text)
    except PunctuationModelUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {
        "success": True,
        "transcription": punctuated,
        "model": "AI4Bharat Cadence-Fast",
        "words_preserved": True,
    }


@app.post("/auth/logout")
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    current_user: dict = Depends(get_current_user),
):
    token_hash = hashlib.sha256(credentials.credentials.encode("utf-8")).hexdigest()
    with closing(_connect_history()) as connection:
        connection.execute("DELETE FROM auth_sessions WHERE token_hash = ?", (token_hash,))
        connection.commit()
    return {"success": True}


@app.post("/auth/password-reset/request")
def request_password_reset(payload: PasswordResetRequest):
    """Send a reset link only when SMTP is configured; never disclose account existence."""
    config = _smtp_settings()
    if config is None:
        return {"success": False, "message": "Password recovery is not configured on this server. Please contact your workspace administrator."}

    email = _normalize_email(payload.email)
    if EMAIL_PATTERN.fullmatch(email):
        user = _find_user_by_email(email)
        if user is not None and user["is_active"]:
            token = secrets.token_urlsafe(40)
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
            now = datetime.now().timestamp()
            with closing(_connect_history()) as connection:
                connection.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", (user["id"],))
                connection.execute(
                    "INSERT INTO password_reset_tokens(token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                    (token_hash, user["id"], _now_iso(), now + RESET_TOKEN_MINUTES * 60),
                )
                connection.commit()
            try:
                _send_password_reset_email(user["email"], token)
            except Exception as exc:
                print("Password reset email delivery failed:", type(exc).__name__)
                with closing(_connect_history()) as connection:
                    connection.execute("DELETE FROM password_reset_tokens WHERE token_hash = ?", (token_hash,))
                    connection.commit()
    return {"success": True, "message": "If an active account matches that email, password reset instructions will be sent."}


@app.post("/auth/password-reset/confirm")
def confirm_password_reset(payload: PasswordResetConfirm):
    _validate_password(payload.new_password)
    token_hash = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()
    now = datetime.now().timestamp()
    with closing(_connect_history()) as connection:
        token_row = connection.execute(
            "SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > ?",
            (token_hash, now),
        ).fetchone()
        if token_row is None:
            raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")
        user_id = token_row["user_id"]
        connection.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (_hash_password(payload.new_password), user_id),
        )
        connection.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", (user_id,))
        connection.execute("DELETE FROM auth_sessions WHERE user_id = ?", (user_id,))
        connection.commit()
    return {"success": True, "message": "Password updated. Please sign in with your new password."}


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

def _normalize_transcript_word(word: str) -> str:
    normalized = unicodedata.normalize("NFKC", word).casefold()
    return "".join(character for character in normalized if character.isalnum())


def _merge_overlapping_transcripts(existing: str, incoming: str, max_overlap: int = 16) -> str:
    """Avoid repeating words when adjacent long-audio chunks overlap."""
    left = existing.split()
    right = incoming.split()
    if not left:
        return incoming.strip()
    if not right:
        return existing.strip()

    limit = min(max_overlap, len(left), len(right))
    overlap = 0
    for size in range(limit, 0, -1):
        left_words = [_normalize_transcript_word(word) for word in left[-size:]]
        right_words = [_normalize_transcript_word(word) for word in right[:size]]
        if left_words == right_words and all(left_words):
            overlap = size
            break

    merged = left + right[overlap:]
    return " ".join(merged).strip()


def transcribe_processed_audio(
    audio_file: Path,
    progress_callback=None,
) -> tuple[str, str]:
    """Run IndicWhisper and return raw + cleaned Tamil text.

    The standard endpoint keeps its existing one-pass behavior. The progress
    workflow reports genuine stage changes and, for longer recordings, runs
    overlapping audio windows so progress advances as windows finish. Short
    recordings remain one model pass to avoid reducing context unnecessarily.
    """
    print("Transcribing with IndicWhisper...")

    generate_kwargs = {"language": "ta", "task": "transcribe"}
    chunk_seconds = TRANSCRIPTION_CHUNK_SECONDS
    overlap_seconds = TRANSCRIPTION_CHUNK_OVERLAP_SECONDS

    if progress_callback is None:
        with _ASR_LOCK:
            result = asr(str(audio_file), generate_kwargs=generate_kwargs)
        raw_text = result["text"].strip()
        return raw_text, clean_tamil_text(raw_text)

    audio, sample_rate = sf.read(str(audio_file), dtype="float32")
    if getattr(audio, "ndim", 1) > 1:
        audio = audio.mean(axis=1)
    sample_rate = int(sample_rate)
    total_samples = len(audio)
    duration = total_samples / sample_rate if sample_rate else 0.0

    if duration <= chunk_seconds or total_samples == 0:
        # The model exposes one atomic inference call for short clips, so the
        # UI shows an indeterminate active state until this call returns.
        with _ASR_LOCK:
            result = asr(str(audio_file), generate_kwargs=generate_kwargs)
        raw_text = result["text"].strip()
        progress_callback(1.0, duration, duration)
        return raw_text, clean_tamil_text(raw_text)

    chunk_size = max(1, int(chunk_seconds * sample_rate))
    overlap_size = max(0, int(overlap_seconds * sample_rate))
    step_size = max(1, chunk_size - overlap_size)
    chunk_starts = list(range(0, total_samples, step_size))
    chunks_text: list[str] = []

    with _ASR_LOCK:
        for index, start_sample in enumerate(chunk_starts):
            end_sample = min(start_sample + chunk_size, total_samples)
            if start_sample >= total_samples:
                break
            chunk = audio[start_sample:end_sample]
            if len(chunk) == 0:
                continue
            result = asr(
                {"array": chunk, "sampling_rate": sample_rate},
                generate_kwargs=generate_kwargs,
            )
            chunk_text = str(result.get("text", "")).strip()
            if chunk_text:
                if chunks_text:
                    chunks_text[-1] = _merge_overlapping_transcripts(chunks_text[-1], chunk_text)
                else:
                    chunks_text.append(chunk_text)

            processed_seconds = min(end_sample / sample_rate, duration)
            progress_callback(
                processed_seconds / duration if duration else (index + 1) / len(chunk_starts),
                processed_seconds,
                duration,
            )

    raw_text = " ".join(part for part in chunks_text if part).strip()
    return raw_text, clean_tamil_text(raw_text)


# ============================================================
# TRANSCRIPTION PROGRESS JOBS
# ============================================================

def _set_transcription_job(job_id: str, **updates) -> None:
    with _TRANSCRIPTION_JOBS_LOCK:
        job = _TRANSCRIPTION_JOBS.get(job_id)
        if job is not None:
            job.update(updates)
            job["updated_epoch"] = time.time()


def _create_transcription_job(job_id: str, user_id: str, filename: str) -> None:
    now = time.time()
    with _TRANSCRIPTION_JOBS_LOCK:
        # Bound local in-memory state and discard old terminal jobs after 6 hours.
        expired = [
            key for key, job in _TRANSCRIPTION_JOBS.items()
            if job.get("status") in {"completed", "failed"}
            and now - job.get("updated_epoch", now) > 6 * 60 * 60
        ]
        for key in expired:
            _TRANSCRIPTION_JOBS.pop(key, None)
        if len(_TRANSCRIPTION_JOBS) >= 250:
            terminal = sorted(
                ((key, job.get("updated_epoch", 0)) for key, job in _TRANSCRIPTION_JOBS.items()
                 if job.get("status") in {"completed", "failed"}),
                key=lambda item: item[1],
            )
            for key, _ in terminal[: max(1, len(_TRANSCRIPTION_JOBS) - 200)]:
                _TRANSCRIPTION_JOBS.pop(key, None)
        _TRANSCRIPTION_JOBS[job_id] = {
            "job_id": job_id,
            "user_id": user_id,
            "filename": filename,
            "status": "queued",
            "progress": 0,
            "stage": "queued",
            "message": "Upload received. Preparing your audio.",
            "result": None,
            "error": None,
            "created_epoch": now,
            "updated_epoch": now,
        }


def _transcription_progress_response(job: dict) -> dict:
    return {
        "job_id": job["job_id"],
        "status": job["status"],
        "progress": int(job.get("progress", 0)),
        "stage": job.get("stage", "queued"),
        "message": job.get("message", ""),
        "result": job.get("result"),
        "error": job.get("error"),
    }


def _process_transcription_job(
    job_id: str,
    input_path: str,
    processed_path: str,
    filename: str,
    user_id: str,
) -> None:
    input_file = Path(input_path)
    processed_file = Path(processed_path)
    try:
        _set_transcription_job(
            job_id, progress=10, stage="preprocessing",
            message="Converting audio to mono, 16 kHz and normalizing it.",
        )
        audio_duration_seconds = preprocess_audio(input_file, processed_file)
        _set_transcription_job(
            job_id, progress=26, stage="transcribing",
            message=f"Audio prepared ({audio_duration_seconds:.1f} seconds). Starting IndicWhisper.",
        )

        def report_model_progress(fraction: float, processed_seconds: float, total_seconds: float) -> None:
            # These updates are based on completed audio windows. For short files,
            # one ASR inference call is atomic and the percentage advances when it returns.
            progress = 30 + round(max(0.0, min(1.0, fraction)) * 54)
            if total_seconds > TRANSCRIPTION_CHUNK_SECONDS:
                message = f"Transcribed {processed_seconds:.1f} of {total_seconds:.1f} seconds of audio."
            else:
                message = "IndicWhisper finished the model pass. Preparing your transcript."
            _set_transcription_job(
                job_id, progress=progress, stage="transcribing", message=message,
            )

        raw_text, final_text = transcribe_processed_audio(
            processed_file, progress_callback=report_model_progress
        )
        _set_transcription_job(
            job_id, progress=89, stage="saving",
            message="Transcription generated. Saving it to your history.",
        )
        record = _create_history_record(
            filename=filename,
            transcription=final_text,
            raw_text=raw_text,
            audio_duration_seconds=audio_duration_seconds,
            user_id=user_id,
        )
        result = {
            "success": True,
            "id": record["id"],
            "created_at": record["created_at"],
            "audio_duration_seconds": record["audio_duration_seconds"],
            "filename": filename,
            "model": "IndicWhisper Tamil",
            "device": device,
            "sample_rate": 16000,
            "channels": 1,
            "raw_text": raw_text,
            "transcription": final_text,
        }
        _set_transcription_job(
            job_id, status="completed", progress=100, stage="completed",
            message="Transcription completed and saved.", result=result, error=None,
        )
    except Exception as exc:
        print("\nERROR during background transcription:")
        print(type(exc).__name__, str(exc))
        _set_transcription_job(
            job_id, status="failed", stage="failed",
            message="Transcription failed. Check the backend terminal and try again.",
            error=str(exc) if isinstance(exc, HTTPException) else "Transcription failed. Check the backend terminal for details.",
        )
    finally:
        for path in (input_file, processed_file):
            try:
                if path.exists():
                    path.unlink()
            except OSError:
                pass


@app.post("/transcribe/start", status_code=202)
async def start_transcription(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Accept an uploaded audio file and process it while the UI polls progress."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file name provided.")

    extension = Path(file.filename).suffix.lower()
    if extension not in {".wav", ".mp3", ".ogg", ".flac", ".m4a"}:
        raise HTTPException(
            status_code=400,
            detail="Unsupported audio format. Supported formats: WAV, MP3, OGG, FLAC, M4A.",
        )

    job_id = uuid.uuid4().hex
    input_file = UPLOAD_DIR / f"{job_id}{extension}"
    processed_file = PROCESSED_DIR / f"{job_id}_16k.wav"
    try:
        with input_file.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        try:
            input_file.unlink(missing_ok=True)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail="Unable to save the uploaded audio file.") from exc
    finally:
        await file.close()

    _create_transcription_job(job_id, current_user["id"], file.filename)
    background_tasks.add_task(
        _process_transcription_job, job_id, str(input_file), str(processed_file),
        file.filename, current_user["id"],
    )
    return {
        "job_id": job_id,
        "status": "queued",
        "progress": 0,
        "stage": "queued",
        "message": "Upload received. Preparing your audio.",
    }


@app.get("/transcribe/progress/{job_id}")
def transcription_progress(
    job_id: str, current_user: dict = Depends(get_current_user)
):
    """Return progress and the result only to the authenticated job owner."""
    with _TRANSCRIPTION_JOBS_LOCK:
        job = _TRANSCRIPTION_JOBS.get(job_id)
        if job is None or job.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=404, detail="Transcription job not found.")
        snapshot = dict(job)
    return _transcription_progress_response(snapshot)


# ============================================================
# TRANSCRIBE ENDPOINT (synchronous compatibility route)
# ============================================================

@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
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
            user_id=current_user["id"],
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
def list_transcription_history(current_user: dict = Depends(get_current_user)):
    """Return only the signed-in user's saved transcription records, newest first."""
    with closing(_connect_history()) as connection:
        rows = connection.execute(
            "SELECT * FROM transcriptions WHERE user_id = ? ORDER BY created_at DESC, rowid DESC",
            (current_user["id"],),
        ).fetchall()
    return {"records": [_history_row_to_dict(row) for row in rows]}


@app.get("/system/status")
def get_system_status(current_user: dict = Depends(get_current_user)):
    """Return real backend/model/storage checks for the signed-in user."""
    model_loaded = globals().get("asr") is not None
    model_files_present = MODEL_PATH.is_dir()
    punctuation_path = PROJECT_ROOT / "models" / "punctuation" / "cadence-fast"
    punctuation_files_present = punctuation_path.is_dir() and any(punctuation_path.iterdir())
    ffmpeg_available = shutil.which("ffmpeg") is not None

    try:
        from docx2pdf import convert as _docx2pdf_convert  # noqa: F401
        pdf_package_installed = True
    except Exception:
        pdf_package_installed = False

    database_ok = False
    history_count = 0
    documents_count = 0
    storage_message = "SQLite database is reachable."
    try:
        with closing(_connect_history()) as connection:
            history_count = int(connection.execute(
                "SELECT COUNT(*) AS count FROM transcriptions WHERE user_id = ?",
                (current_user["id"],),
            ).fetchone()["count"])
            documents_count = int(connection.execute(
                "SELECT COUNT(*) AS count FROM generated_documents WHERE user_id = ?",
                (current_user["id"],),
            ).fetchone()["count"])
        database_ok = True
    except Exception:
        storage_message = "SQLite could not be checked. Review the backend terminal for details."

    return {
        "status": "healthy" if model_loaded and database_ok else "degraded",
        "checked_at": _now_iso(),
        "backend_online": True,
        "model_name": "IndicWhisper Tamil",
        "model_loaded": model_loaded,
        "model_files_present": model_files_present,
        "device": device,
        "punctuation_model_name": "AI4Bharat Cadence-Fast",
        "punctuation_model_files_present": punctuation_files_present,
        "ffmpeg_available": ffmpeg_available,
        "docx_generator_available": True,
        "pdf_conversion_package_installed": pdf_package_installed,
        "database_ok": database_ok,
        "storage_message": storage_message,
        "history_count": history_count,
        "documents_count": documents_count,
    }


@app.get("/history/{record_id}")
def get_transcription_history(record_id: str, current_user: dict = Depends(get_current_user)):
    record = _get_history_record(record_id, current_user["id"])
    if record is None:
        raise HTTPException(status_code=404, detail="Transcription record not found.")
    return record


@app.put("/history/{record_id}")
def update_transcription_history(
    record_id: str, payload: dict, current_user: dict = Depends(get_current_user)
):
    """Save edits only to a record owned by the signed-in user."""
    transcription = payload.get("transcription")
    if not isinstance(transcription, str) or not transcription.strip():
        raise HTTPException(
            status_code=400,
            detail="A non-empty 'transcription' field is required.",
        )

    now = _now_iso()
    with closing(_connect_history()) as connection:
        cursor = connection.execute(
            "UPDATE transcriptions SET transcription = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            (transcription.strip(), now, record_id, current_user["id"]),
        )
        connection.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Transcription record not found.")
        row = connection.execute(
            "SELECT * FROM transcriptions WHERE id = ? AND user_id = ?",
            (record_id, current_user["id"]),
        ).fetchone()
    return _history_row_to_dict(row)


@app.delete("/history/{record_id}")
def delete_transcription_history(record_id: str, current_user: dict = Depends(get_current_user)):
    """Delete one history record only when it belongs to the signed-in user."""
    with closing(_connect_history()) as connection:
        cursor = connection.execute(
            "DELETE FROM transcriptions WHERE id = ? AND user_id = ?",
            (record_id, current_user["id"]),
        )
        connection.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Transcription record not found.")
    return {"success": True, "id": record_id}


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
    user_id: str,
    created_at: str | None = None,
) -> None:
    """Persist metadata so the Documents page can list real generated files."""
    now = created_at or _now_iso()
    document_id = uuid.uuid4().hex
    with closing(_connect_history()) as connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO generated_documents
                (id, filename, title, source_filename, format, created_at, size_bytes, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                document_id,
                path.name,
                title.strip() or path.stem,
                source_filename.strip(),
                file_format.upper(),
                now,
                path.stat().st_size,
                user_id,
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
def list_generated_documents(current_user: dict = Depends(get_current_user)):
    """List only generated documents owned by the signed-in user."""
    registered: list[dict] = []
    with closing(_connect_history()) as connection:
        rows = connection.execute(
            "SELECT * FROM generated_documents WHERE user_id = ? ORDER BY created_at DESC, rowid DESC",
            (current_user["id"],),
        ).fetchall()
    for row in rows:
        item = _document_row_to_dict(row)
        path = OUTPUT_DIR / item["filename"]
        if path.is_file() and path.parent.resolve() == OUTPUT_DIR.resolve():
            item["size_bytes"] = path.stat().st_size
            registered.append(item)
    return {"documents": registered}


@app.get("/documents/{filename}")
def download_generated_document(
    filename: str, current_user: dict = Depends(get_current_user)
):
    """Download a document only if it belongs to the signed-in user."""
    if Path(filename).name != filename or filename in {".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid document filename.")

    with closing(_connect_history()) as connection:
        owned = connection.execute(
            "SELECT 1 FROM generated_documents WHERE filename = ? AND user_id = ?",
            (filename, current_user["id"]),
        ).fetchone()
    if owned is None:
        raise HTTPException(status_code=404, detail="Generated document not found.")

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
async def generate_pdf_endpoint(payload: dict, current_user: dict = Depends(get_current_user)):
    """Generate a Tamil PDF directly from HTML using Chromium, with ReportLab fallback."""
    text = payload.get("text")
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=400, detail="A non-empty 'text' field is required.")

    string_fields = (
        "title", "source_filename", "department", "district", "taluk", "office_name",
        "date", "reference_number", "prepared_by", "designation", "subject", "template_name",
    )
    if any(key in payload and not isinstance(payload.get(key), str) for key in string_fields):
        raise HTTPException(status_code=400, detail="Document metadata must be text values.")

    title = (payload.get("title") or payload.get("document_title") or "அதிகாரப்பூர்வ அரசு அறிக்கை").strip()
    output_name = save_output_text(text, "tamil_transcription", title)
    output_file = OUTPUT_DIR / f"{output_name}.pdf"
    document_data = {
        "text": text.strip(),
        "document_title": title,
        "department": payload.get("department", "தமிழ்நாடு அரசு"),
        "district": payload.get("district", ""),
        "taluk": payload.get("taluk", ""),
        "office_name": payload.get("office_name", ""),
        "date": payload.get("date", ""),
        "reference_number": payload.get("reference_number", ""),
        "prepared_by": payload.get("prepared_by", ""),
        "designation": payload.get("designation", ""),
        "subject": payload.get("subject", title),
        "template_name": payload.get("template_name", "official_report"),
    }
    try:
        engine = await run_in_threadpool(generate_tamil_pdf, document_data, output_file)
        _register_generated_document(
            output_file,
            title=title,
            source_filename=payload.get("source_filename", ""),
            file_format="PDF",
            user_id=current_user["id"],
        )
        return FileResponse(
            path=str(output_file),
            media_type="application/pdf",
            filename=output_file.name,
            headers={"X-TamilTranscribe-PDF-Engine": engine},
        )
    except HTTPException:
        raise
    except Exception as exc:
        try:
            if output_file.exists():
                output_file.unlink()
        except OSError:
            pass
        print("\nERROR generating direct Tamil PDF:")
        print(exc)
        raise HTTPException(status_code=500, detail=f"Direct PDF generation failed: {exc}") from exc
@app.post("/generate/docx")
async def generate_docx_endpoint(
    payload: dict, current_user: dict = Depends(get_current_user)
):
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
            output_file, title=title, source_filename=source_filename,
            file_format="DOCX", user_id=current_user["id"]
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
