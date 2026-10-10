const API_BASE_URL = "http://127.0.0.1:8000";

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

async function parseApiError(response: Response) {
  try {
    const data = await response.json();
    if (data?.detail) return String(data.detail);
  } catch {
    // The response may not contain JSON.
  }

  return `API request failed: ${response.status}`;
}

export async function transcribeAudio(
  file: File,
): Promise<TranscriptionResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function fetchTranscriptionHistory(): Promise<HistoryRecord[]> {
  const response = await fetch(`${API_BASE_URL}/history`, { method: "GET" });
  if (!response.ok) throw new Error(await parseApiError(response));
  const data = await response.json();
  return Array.isArray(data?.records) ? data.records : [];
}


export async function fetchGeneratedDocuments(): Promise<SavedDocument[]> {
  const response = await fetch(`${API_BASE_URL}/documents`, { method: "GET" });
  if (!response.ok) throw new Error(await parseApiError(response));
  const data = await response.json();
  return Array.isArray(data?.documents) ? data.documents : [];
}

export async function downloadSavedDocument(filename: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(filename)}`);
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

export async function updateTranscriptionHistory(
  id: string,
  transcription: string,
): Promise<HistoryRecord> {
  const response = await fetch(`${API_BASE_URL}/history/${encodeURIComponent(id)}`, {
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

async function generateDocument(
  endpoint: "pdf" | "docx",
  text: string,
  title?: string,
  sourceFilename?: string,
): Promise<GeneratedDocument> {
  const response = await fetch(`${API_BASE_URL}/generate/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      title: title || "Tamil transcription",
      source_filename: sourceFilename || "",
    }),
  });

  if (!response.ok) throw new Error(await parseApiError(response));

  const blob = await response.blob();
  const fallback = `tamil_transcription.${endpoint}`;
  const filename = getFilenameFromHeaders(response, fallback);
  return { blob, filename };
}

export function generatePdf(text: string, title?: string, sourceFilename?: string) {
  return generateDocument("pdf", text, title, sourceFilename);
}

export function generateDocx(text: string, title?: string, sourceFilename?: string) {
  return generateDocument("docx", text, title, sourceFilename);
}
