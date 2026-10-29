const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const AUTH_STORAGE_KEY = "tamiltranscribe.accessToken";

export type AuthUser = {
  id: string;
  full_name: string;
  email: string;
  department: string;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: "bearer" | string;
  expires_in: number;
  user: AuthUser;
};

export type SystemStatus = {
  status: "healthy" | "degraded" | string;
  checked_at: string;
  backend_online: boolean;
  model_name: string;
  model_loaded: boolean;
  model_files_present: boolean;
  device: string;
  punctuation_model_name: string;
  punctuation_model_files_present: boolean;
  ffmpeg_available: boolean;
  docx_generator_available: boolean;
  pdf_conversion_package_installed: boolean;
  database_ok: boolean;
  storage_message: string;
  history_count: number;
  documents_count: number;
};

export type TranscriptionResponse = {
  success: boolean;
  id: string;
  created_at: string;
  audio_duration_seconds: number | null;
  filename: string;
  model: string;
  device: string;
  sample_rate: number;
  channels: number;
  raw_text: string;
  transcription: string;
};

export type TranscriptionProgress = {
  percent: number;
  stage: "uploading" | "queued" | "preprocessing" | "transcribing" | "saving" | "completed" | "failed";
  label: string;
  message: string;
};

type TranscriptionJob = {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  stage: TranscriptionProgress["stage"];
  message: string;
  result?: TranscriptionResponse | null;
  error?: string | null;
};

export type HistoryRecord = {
  id: string;
  filename: string;
  created_at: string;
  updated_at: string;
  status: string;
  transcription: string;
  raw_text: string;
  model: string;
  device: string;
  sample_rate: number;
  channels: number;
  audio_duration_seconds: number | null;
};

export type GeneratedDocument = {
  blob: Blob;
  filename: string;
};

export type SavedDocument = {
  id: string;
  filename: string;
  title: string;
  source_filename: string;
  format: "PDF" | "DOCX" | string;
  created_at: string;
  size_bytes: number;
};

export type ApiMessage = {
  success?: boolean;
  message: string;
};

function storedToken(): string | null {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in a restricted browser context.
  }
}

function saveAuthSession(token: string, rememberMe: boolean): void {
  clearAuthSession();
  try {
    (rememberMe ? localStorage : sessionStorage).setItem(AUTH_STORAGE_KEY, token);
  } catch {
    throw new Error("Your browser blocked session storage. Enable site storage and try again.");
  }
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data?.detail) return String(data.detail);
    if (data?.message) return String(data.message);
  } catch {
    // The response may not contain JSON.
  }
  return `API request failed: ${response.status}`;
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Error("Cannot connect to the TamilTranscribe backend. Make sure FastAPI is running and try again.");
  }
}

async function publicRequest(path: string, init: RequestInit = {}): Promise<Response> {
  return request(path, init);
}

async function authenticatedRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = storedToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await request(path, { ...init, headers });
  if (response.status === 401) {
    clearAuthSession();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("tamiltranscribe:unauthorized"));
    }
  }
  return response;
}

async function parseAuthResponse(response: Response, rememberMe: boolean): Promise<AuthResponse> {
  if (!response.ok) throw new Error(await parseApiError(response));
  const data = (await response.json()) as AuthResponse;
  if (!data.access_token || !data.user) throw new Error("The server returned an invalid sign-in response.");
  saveAuthSession(data.access_token, rememberMe);
  return data;
}

export async function loginUser(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<AuthResponse> {
  const response = await publicRequest("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, remember_me: rememberMe }),
  });
  return parseAuthResponse(response, rememberMe);
}

export async function googleLoginUser(
  credential: string,
  rememberMe: boolean,
): Promise<AuthResponse> {
  const response = await publicRequest("/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credential,
      remember_me: rememberMe,
    }),
  });

  return parseAuthResponse(response, rememberMe);
}


export async function registerUser(input: {
  fullName: string;
  email: string;
  department: string;
  password: string;
  rememberMe: boolean;
}): Promise<AuthResponse> {
  const response = await publicRequest("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: input.fullName,
      email: input.email,
      department: input.department,
      password: input.password,
      remember_me: input.rememberMe,
    }),
  });
  return parseAuthResponse(response, input.rememberMe);
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await authenticatedRequest("/auth/me");
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function logoutUser(): Promise<void> {
  try {
    const response = await authenticatedRequest("/auth/logout", { method: "POST" });
    if (!response.ok && response.status !== 401) throw new Error(await parseApiError(response));
  } finally {
    clearAuthSession();
  }
}

export async function requestPasswordReset(email: string): Promise<ApiMessage> {
  const response = await publicRequest("/auth/password-reset/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<ApiMessage> {
  const response = await publicRequest("/auth/password-reset/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

function emitTranscriptionProgress(
  callback: ((progress: TranscriptionProgress) => void) | undefined,
  progress: TranscriptionProgress,
) {
  callback?.({ ...progress, percent: Math.max(0, Math.min(100, Math.round(progress.percent))) });
}

function parseXhrError(xhr: XMLHttpRequest): string {
  try {
    const data = JSON.parse(xhr.responseText || "{}");
    if (data?.detail) return String(data.detail);
    if (data?.message) return String(data.message);
  } catch {
    // The server may return a plain-text response.
  }
  return `API request failed: ${xhr.status || "network error"}`;
}

function uploadTranscription(file: File, onUploadProgress?: (percent: number) => void): Promise<{ job_id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    xhr.open("POST", `${API_BASE_URL}/transcribe/start`);
    const token = storedToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onUploadProgress?.((event.loaded / event.total) * 100);
      }
    };
    xhr.onerror = () => reject(new Error("Cannot connect to the TamilTranscribe backend. Make sure FastAPI is running and try again."));
    xhr.onabort = () => reject(new Error("Audio upload was cancelled."));
    xhr.onload = () => {
      if (xhr.status === 401) {
        clearAuthSession();
        if (typeof window !== "undefined") window.dispatchEvent(new Event("tamiltranscribe:unauthorized"));
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(parseXhrError(xhr)));
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText) as { job_id?: string };
        if (!data.job_id) {
          reject(new Error("The backend did not return a transcription job ID."));
          return;
        }
        resolve({ job_id: data.job_id });
      } catch {
        reject(new Error("The backend returned an invalid transcription response."));
      }
    };
    xhr.send(formData);
  });
}

const TRANSCRIPTION_STAGE_LABELS: Record<TranscriptionProgress["stage"], string> = {
  uploading: "Uploading audio",
  queued: "Upload complete",
  preprocessing: "Preparing audio",
  transcribing: "Transcribing audio",
  saving: "Saving transcript",
  completed: "Completed",
  failed: "Transcription failed",
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function transcribeAudio(
  file: File,
  onProgress?: (progress: TranscriptionProgress) => void,
): Promise<TranscriptionResponse> {
  emitTranscriptionProgress(onProgress, {
    percent: 0, stage: "uploading", label: TRANSCRIPTION_STAGE_LABELS.uploading, message: "Sending your audio to the local transcription service.",
  });

  // Upload progress is measured from the browser's real byte-upload events.
  const { job_id } = await uploadTranscription(file, (uploadPercent) => {
    emitTranscriptionProgress(onProgress, {
      percent: uploadPercent * 0.18,
      stage: "uploading",
      label: TRANSCRIPTION_STAGE_LABELS.uploading,
      message: `Uploading audio · ${Math.round(uploadPercent)}% sent`,
    });
  });

  emitTranscriptionProgress(onProgress, {
    percent: 20, stage: "queued", label: TRANSCRIPTION_STAGE_LABELS.queued, message: "The audio has reached the backend. Preparing the recording.",
  });

  const startedAt = Date.now();
  const maxWaitMs = 45 * 60 * 1000;
  while (Date.now() - startedAt < maxWaitMs) {
    await wait(550);
    const response = await authenticatedRequest(`/transcribe/progress/${encodeURIComponent(job_id)}`);
    if (!response.ok) throw new Error(await parseApiError(response));
    const job = (await response.json()) as TranscriptionJob;
    const stage = job.stage || "queued";
    const percent = stage === "completed" ? 100 : 20 + Math.max(0, Math.min(100, job.progress || 0)) * 0.8;

    emitTranscriptionProgress(onProgress, {
      percent,
      stage,
      label: TRANSCRIPTION_STAGE_LABELS[stage] || "Processing audio",
      message: job.message || "Processing your Tamil audio.",
    });

    if (job.status === "failed" || stage === "failed") {
      throw new Error(job.error || job.message || "Transcription failed. Please try again.");
    }
    if (job.status === "completed" || stage === "completed") {
      if (!job.result?.success) throw new Error("The backend completed the job without returning a transcript.");
      emitTranscriptionProgress(onProgress, {
        percent: 100, stage: "completed", label: "Completed", message: "Transcription is complete and saved to your history.",
      });
      return job.result;
    }
  }

  throw new Error("Transcription is taking longer than expected. Check the backend terminal before retrying.");
}

export async function fetchTranscriptionHistory(): Promise<HistoryRecord[]> {
  const response = await authenticatedRequest("/history", { method: "GET" });
  if (!response.ok) throw new Error(await parseApiError(response));
  const data = await response.json();
  return Array.isArray(data?.records) ? data.records : [];
}

export async function deleteTranscriptionHistory(id: string): Promise<void> {
  const response = await authenticatedRequest(`/history/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const response = await authenticatedRequest("/system/status", { method: "GET" });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function fetchGeneratedDocuments(): Promise<SavedDocument[]> {
  const response = await authenticatedRequest("/documents", { method: "GET" });
  if (!response.ok) throw new Error(await parseApiError(response));
  const data = await response.json();
  return Array.isArray(data?.documents) ? data.documents : [];
}

export async function downloadSavedDocument(filename: string): Promise<void> {
  const response = await authenticatedRequest(`/documents/${encodeURIComponent(filename)}`);
  if (!response.ok) throw new Error(await parseApiError(response));

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function restoreTamilPunctuation(text: string): Promise<{ transcription: string; model: string }> {
  const response = await authenticatedRequest("/postprocess/punctuation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  const data = await response.json();
  if (typeof data?.transcription !== "string") {
    throw new Error("The punctuation service returned an invalid response.");
  }
  return { transcription: data.transcription, model: String(data.model || "Tamil punctuation model") };
}

export async function updateTranscriptionHistory(
  id: string,
  transcription: string,
): Promise<HistoryRecord> {
  const response = await authenticatedRequest(`/history/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcription }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

function getFilenameFromHeaders(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition");
  if (!disposition) return fallback;

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].replace(/^"|"$/g, ""));
    } catch {
      return utfMatch[1].replace(/^"|"$/g, "");
    }
  }

  const regularMatch = disposition.match(/filename="?([^";]+)"?/i);
  return regularMatch?.[1] ?? fallback;
}

type PdfDocumentMetadata = {
  department: string;
  district: string;
  taluk: string;
  office_name: string;
  date: string;
  reference_number: string;
  prepared_by: string;
  designation: string;
  subject: string;
  template_name: "official_report" | "meeting_minutes";
};

async function generateDocument(
  endpoint: "pdf" | "docx",
  text: string,
  title?: string,
  sourceFilename?: string,
  metadata?: PdfDocumentMetadata,
): Promise<GeneratedDocument> {
  const response = await authenticatedRequest(`/generate/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      title: title || "Tamil transcription",
      source_filename: sourceFilename || "",
      ...(endpoint === "pdf" && metadata ? metadata : {}),
    }),
  });

  if (!response.ok) throw new Error(await parseApiError(response));
  const blob = await response.blob();
  const fallback = `tamil_transcription.${endpoint}`;
  const filename = getFilenameFromHeaders(response, fallback);
  return { blob, filename };
}

export function generatePdf(
  text: string,
  title?: string,
  sourceFilename?: string,
  metadata?: PdfDocumentMetadata,
) {
  return generateDocument("pdf", text, title, sourceFilename, metadata);
}

export function generateDocx(text: string, title?: string, sourceFilename?: string) {
  return generateDocument("docx", text, title, sourceFilename);
}