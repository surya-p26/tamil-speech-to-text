# TamilTranscribe authentication update

This patch replaces the demonstration-only login screen with a real local account flow and protects the FastAPI endpoints that contain user data.

## What changes

- Sign in checks the submitted email and password against the backend.
- New users can register with a name, email, department/organization and password.
- Passwords are stored as salted PBKDF2-HMAC-SHA256 hashes; plaintext passwords are never stored.
- The server issues random opaque session tokens. Their hashes are stored in SQLite. Sessions expire after 8 hours, or 30 days when “Keep me signed in” is selected.
- Sign out revokes the current session. Password reset revokes all of the account's sessions.
- Transcription, history, document listing/download and PDF/DOCX generation endpoints require a valid signed-in session. History and document metadata are filtered by account.
- The first account created on an existing local database claims legacy records/documents that have no owner, so the current single-user data remains visible to that account. Later accounts cannot see those records.
- The former prefilled demo email/password and fake Government SSO sign-in action are removed. Government SSO is clearly marked as not connected.

## Apply the patch

1. Stop the Vite frontend and FastAPI backend.
2. Back up `api.py`, `frontend/src/App.tsx`, `frontend/src/api.ts`, `frontend/src/index.css`, and `data/transcription_history.sqlite3` before replacing anything. Keep the backup outside the directory you stage for Git.
3. Extract this ZIP into `C:\tamil_speech_to_text`, allowing the paths in the archive to merge into the existing project. The archive includes `api.py`, `AUTH_SETUP.md`, an authentication-aware `test_api.py`, and the three updated frontend source files.
4. Keep your existing `frontend/package.json`, `package-lock.json`, `index.html`, `main.tsx`, and Vite configuration. This patch adds no Python or npm packages.

## Run locally

Backend terminal:

```powershell
cd C:\tamil_speech_to_text
.\venv\Scripts\Activate.ps1
python -m py_compile api.py
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Frontend terminal:

```powershell
cd C:\tamil_speech_to_text\frontend
npm run build
npm run dev
```

Open the URL printed by Vite. Create your own account from **Create an account**, then use that account to sign in. Do not use the previous demo credentials; they are no longer valid. To verify access controls, sign out and test a wrong password and then sign in correctly. Keep the backend terminal running during use.

## Optional: enable password-reset email

Forgot-password works when SMTP is configured. Without SMTP, the UI reports that recovery is not configured and asks the user to contact the workspace administrator. To enable email-based reset, set these environment variables in the PowerShell window that will start Uvicorn (do not put real values into Git):

```powershell
$env:TAMILTRANSCRIBE_SMTP_HOST = "smtp.your-provider.example"
$env:TAMILTRANSCRIBE_SMTP_PORT = "587"
$env:TAMILTRANSCRIBE_SMTP_USER = "your-smtp-user"
$env:TAMILTRANSCRIBE_SMTP_PASSWORD = "your-app-specific-smtp-password"
$env:TAMILTRANSCRIBE_SMTP_FROM = "no-reply@your-domain.example"
$env:TAMILTRANSCRIBE_FRONTEND_URL = "http://localhost:8443"
python -m uvicorn api:app --host 127.0.0.1 --port 8000
```

Use the SMTP provider's official settings and an app-specific password where supported. Reset links expire after 30 minutes. For a frontend running on another origin, set `TAMILTRANSCRIBE_FRONTEND_URL` accordingly and add the exact frontend origin to `TAMILTRANSCRIBE_CORS_ORIGINS` (comma-separated origins).

## Security and deployment notes

This is an improvement for the existing local prototype, not a claim that it is ready for public government deployment. The browser stores the opaque bearer token in browser storage, so production deployment should move to secure HttpOnly cookies, require HTTPS, restrict account creation (for example, invitation-only/verified accounts), configure rate limits and monitoring, and add a security review. Do not expose the API directly to the public internet as-is. Government SSO requires a real identity-provider integration; no SSO provider is configured by this patch.
