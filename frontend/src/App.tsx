import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  fetchTranscriptionHistory,
  fetchGeneratedDocuments,
  downloadSavedDocument,
  generateDocx,
  generatePdf,
  transcribeAudio,
  updateTranscriptionHistory,
  type GeneratedDocument,
  type SavedDocument,
  type HistoryRecord,
  type TranscriptionResponse,
} from "./api";

type Page =
  | "dashboard"
  | "upload"
  | "preprocess"
  | "transcribing"
  | "editor"
  | "postprocess"
  | "generator"
  | "export"
  | "history"
  | "documents"
  | "evaluation"
  | "settings"
  | "states";

type IconName =
  | "grid"
  | "plus"
  | "clock"
  | "file"
  | "chart"
  | "settings"
  | "search"
  | "bell"
  | "chevron"
  | "upload"
  | "audio"
  | "check"
  | "dots"
  | "download"
  | "play"
  | "pause"
  | "edit"
  | "filter"
  | "arrow"
  | "sparkles"
  | "refresh"
  | "alert"
  | "menu"
  | "close"
  | "folder"
  | "users"
  | "shield"
  | "logout";

const icons: Record<IconName, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  file: <><path d="M6 2.8h8l4 4V21H6z" /><path d="M14 3v5h5M9 13h6M9 17h5" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.82 2.82-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.82-2.82.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06L7.02 4.24l.06.06A1.7 1.7 0 0 0 8.96 4a1.7 1.7 0 0 0 1-1.55V2h4v.45A1.7 1.7 0 0 0 15 4a1.7 1.7 0 0 0 1.88.34l.06-.06 2.82 2.82-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21v4h-.05a1.7 1.7 0 0 0-1.55 1z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  chevron: <><path d="m9 18 6-6-6-6" /></>,
  upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5M4 15v5h16v-5" /></>,
  audio: <><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  dots: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  download: <><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14" /></>,
  play: <><path d="m8 5 11 7-11 7z" /></>,
  pause: <><path d="M9 5v14M15 5v14" /></>,
  edit: <><path d="m4 16-1 5 5-1L19 9l-4-4zM13.5 6.5l4 4" /></>,
  filter: <><path d="M3 5h18l-7 8v6l-4 2v-8z" /></>,
  arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
  sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2zM18.5 14l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7zM5.5 14l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5M6.1 8a7 7 0 0 1 11.8-1L20 12M4 12l2.1 5a7 7 0 0 0 11.8-1" /></>,
  alert: <><path d="M12 3 2.5 20h19zM12 9v5M12 17h.01" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  folder: <><path d="M3 6h7l2 2h9v11H3z" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a5 5 0 0 1 10 0v2M16 11a3 3 0 0 0 0-6M15 14a5 5 0 0 1 6 4v2" /></>,
  shield: <><path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
  logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10" /></>,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

function Button({ children, variant = "primary", icon, onClick, className = "", disabled = false }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; icon?: IconName; onClick?: () => void; className?: string; disabled?: boolean }) {
  return <button className={`btn btn-${variant} ${className}`} onClick={onClick} disabled={disabled}>{icon && <Icon name={icon} size={18} />}<span>{children}</span></button>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function Badge({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "amber" | "gray" | "red" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const flow: { page: Page; label: string }[] = [
  { page: "upload", label: "Upload" },
  { page: "preprocess", label: "Pre-process" },
  { page: "transcribing", label: "Transcribe" },
  { page: "editor", label: "Review" },
  { page: "postprocess", label: "Refine" },
  { page: "generator", label: "Generate" },
  { page: "export", label: "Export" },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="logo-wrap">
    <div className="logo-mark"><span>த</span><i /></div>
    {!compact && <div><strong>TamilTranscribe</strong><small>அரசு AI எழுத்தாக்கம்</small></div>}
  </div>;
}

function Login({ onLogin }: { onLogin: () => void }) {
  return <main className="login-page">
    <div className="login-brand">
      <Logo />
      <div className="welcome-copy">
        <Badge tone="blue"><Icon name="shield" size={14} /> Government-grade AI</Badge>
        <h1>Tamil speech.<br /><span>Officially documented.</span></h1>
        <p>Secure, accurate Tamil speech-to-text built for government departments and public institutions.</p>
        <div className="login-features">
          <div><Icon name="sparkles" /><span><b>IndicWhisper AI</b><small>Optimized for Tamil speech</small></span></div>
          <div><Icon name="shield" /><span><b>Private & secure</b><small>Your files stay protected</small></span></div>
          <div><Icon name="file" /><span><b>Official formats</b><small>Export to PDF and DOCX</small></span></div>
        </div>
      </div>
      <p className="login-foot">தமிழ்நாடு அரசு நிர்வாக பயன்பாட்டிற்காக வடிவமைக்கப்பட்டது</p>
    </div>
    <div className="login-panel">
      <Card className="login-card">
        <div className="mobile-logo"><Logo /></div>
        <span className="eyebrow">WELCOME BACK</span>
        <h2>Sign in to your workspace</h2>
        <p>Use your department credentials to continue.</p>
        <label>Official email address<input type="email" defaultValue="admin@tn.gov.in" /></label>
        <label>Password<div className="input-wrap"><input type="password" defaultValue="password123" /><button aria-label="Show password">Show</button></div></label>
        <div className="login-options"><label className="check-label"><input type="checkbox" defaultChecked /> Keep me signed in</label><button>Forgot password?</button></div>
        <Button className="full-btn" onClick={onLogin}>Sign in securely <Icon name="arrow" size={18} /></Button>
        <div className="sso-divider"><span>or continue with</span></div>
        <Button className="full-btn" variant="secondary" icon="shield" onClick={onLogin}>Tamil Nadu Government SSO</Button>
        <div className="security-note"><Icon name="shield" size={16} /> Protected with enterprise-grade encryption</div>
      </Card>
      <p className="support-line">Need help? Contact <b>IT Support</b></p>
    </div>
  </main>;
}

const nav: { section?: string; page: Page; label: string; icon: IconName }[] = [
  { section: "WORKSPACE", page: "dashboard", label: "Dashboard", icon: "grid" },
  { page: "upload", label: "New transcription", icon: "plus" },
  { page: "history", label: "Transcription history", icon: "clock" },
  { page: "documents", label: "Documents", icon: "folder" },
  { section: "INSIGHTS", page: "evaluation", label: "Evaluation", icon: "chart" },
  { page: "states", label: "System states", icon: "alert" },
  { section: "ADMINISTRATION", page: "settings", label: "Settings", icon: "settings" },
];

function Shell({ page, setPage, onLogout, children }: { page: Page; setPage: (page: Page) => void; onLogout: () => void; children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  return <div className="app-shell">
    <aside className={`sidebar ${menu ? "open" : ""}`}>
      <div className="side-head"><Logo /><button className="icon-btn mobile-only" onClick={() => setMenu(false)}><Icon name="close" /></button></div>
      <nav>
        {nav.map((item) => <div key={item.page}>
          {item.section && <span className="nav-section">{item.section}</span>}
          <button className={page === item.page ? "active" : ""} onClick={() => { setPage(item.page); setMenu(false); }}><Icon name={item.icon} size={19} /><span>{item.label}</span></button>
        </div>)}
      </nav>
      <div className="side-profile">
        <div className="avatar">AK</div><div><strong>Arun Kumar</strong><small>Administrator</small></div>
        <button className="icon-btn" onClick={onLogout} title="Sign out"><Icon name="logout" size={18} /></button>
      </div>
    </aside>
    {menu && <div className="scrim" onClick={() => setMenu(false)} />}
    <div className="main-area">
      <header className="topbar">
        <button className="icon-btn mobile-only" onClick={() => setMenu(true)}><Icon name="menu" /></button>
        <div className="top-search"><Icon name="search" size={18} /><input placeholder="Search transcriptions, documents..." /><kbd>⌘ K</kbd></div>
        <div className="top-actions"><button className="icon-btn notification"><Icon name="bell" size={19} /><i /></button><span className="top-separator" /><div className="dept"><span>Department of Revenue</span><Icon name="chevron" size={16} /></div></div>
      </header>
      <main className="content">{children}</main>
    </div>
  </div>;
}

function PageHead({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-head"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function FlowSteps({ current }: { current: Page }) {
  const active = flow.findIndex((f) => f.page === current);
  return <div className="flow-steps">{flow.map((step, i) => <div className={`${i < active ? "done" : ""} ${i === active ? "current" : ""}`} key={step.page}><span>{i < active ? <Icon name="check" size={14} /> : i + 1}</span><small>{step.label}</small></div>)}</div>;
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "00:00";
  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getBaseFileName(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "").trim();
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildDocumentText({
  title,
  department,
  date,
  referenceNumber,
  preparedBy,
  transcript,
}: {
  title: string;
  department: string;
  date: string;
  referenceNumber: string;
  preparedBy: string;
  transcript: string;
}) {
  return [
    "தமிழ்நாடு அரசு",
    title,
    `துறை: ${department}`,
    `தேதி: ${date}`,
    `குறிப்பு எண்: ${referenceNumber}`,
    `தயாரித்தது: ${preparedBy}`,
    "படியெழுத்தாக்கம்",
    transcript,
  ].join("\n\n");
}

function downloadGeneratedDocument(document: GeneratedDocument) {
  const url = URL.createObjectURL(document.blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = document.filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function FileTable({
  records,
  onOpen,
  loading = false,
  error = null,
}: {
  records: HistoryRecord[];
  onOpen: (record: HistoryRecord) => void;
  loading?: boolean;
  error?: string | null;
}) {
  if (loading) {
    return <div className="history-message"><span className="state-loader" />Loading saved transcriptions...</div>;
  }
  if (error) {
    return <div className="history-message inline-message warning"><Icon name="alert" /> {error}</div>;
  }
  if (!records.length) {
    return <div className="history-empty"><div className="state-illustration empty"><Icon name="audio" size={28} /></div><h3>No transcriptions yet</h3><p>Upload a Tamil audio file above. Completed transcriptions will appear here automatically.</p></div>;
  }

  return <div className="file-table file-table-history">
    <div className="table-row table-header"><span>FILE NAME</span><span>DATE</span><span>DURATION</span><span>STATUS</span><span>TRANSCRIPT PREVIEW</span><span /></div>
    {records.map((record) => <div
      className="table-row history-data-row"
      key={record.id}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(record)}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(record); } }}
      title="Open this saved transcript"
    >
      <span className="file-name"><i><Icon name="audio" size={18} /></i><span><b lang="ta">{record.filename}</b><small>{record.model || "Tamil audio transcription"}</small></span></span>
      <span>{formatHistoryDate(record.created_at)}</span>
      <span>{formatDuration(record.audio_duration_seconds)}</span>
      <span><Badge tone="green"><Icon name="check" size={12} /> {record.status || "Completed"}</Badge></span>
      <span className="history-preview" lang="ta">{record.transcription?.trim() ? (record.transcription.length > 82 ? `${record.transcription.slice(0, 82)}…` : record.transcription) : "No transcript text"}</span>
      <button className="icon-btn" title="Open transcript" onClick={(event) => { event.stopPropagation(); onOpen(record); }}><Icon name="chevron" /></button>
    </div>)}
  </div>;
}

function RecentTranscriptions({
  setPage,
  onOpenRecord,
}: {
  setPage: (page: Page) => void;
  onOpenRecord: (record: HistoryRecord) => void;
}) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchTranscriptionHistory()
      .then((items) => { if (active) setRecords(items.slice(0, 6)); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load transcription history."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  return <Card className="table-card recent-transcriptions-card">
    <div className="card-head"><div><h2>Recent transcriptions</h2><p>Your latest completed audio transcriptions</p></div><div className="recent-actions"><Button variant="secondary" icon="refresh" onClick={() => setReloadKey((key) => key + 1)}>Refresh</Button><Button variant="ghost" onClick={() => setPage("history")}>View history <Icon name="arrow" size={16} /></Button></div></div>
    <FileTable records={records} loading={loading} error={error} onOpen={onOpenRecord} />
  </Card>;
}

function Dashboard({
  setPage,
  selectedFile,
  audioDuration,
  setSelectedFile,
  setTranscriptionResult,
  setTranscriptText,
  setApiError,
  setAudioDuration,
  setGeneratedDocuments,
  onOpenRecord,
}: {
  setPage: (page: Page) => void;
  selectedFile: File | null;
  audioDuration: number | null;
  setSelectedFile: (file: File | null) => void;
  setTranscriptionResult: (result: TranscriptionResponse | null) => void;
  setTranscriptText: (text: string) => void;
  setApiError: (error: string | null) => void;
  setAudioDuration: (seconds: number | null) => void;
  setGeneratedDocuments: (documents: { pdf: GeneratedDocument; docx: GeneratedDocument } | null) => void;
  onOpenRecord: (record: HistoryRecord) => void;
}) {
  return <>
    <UploadPage
      embedded
      setPage={setPage}
      selectedFile={selectedFile}
      audioDuration={audioDuration}
      setSelectedFile={setSelectedFile}
      setTranscriptionResult={setTranscriptionResult}
      setTranscriptText={setTranscriptText}
      setApiError={setApiError}
      setAudioDuration={setAudioDuration}
      setGeneratedDocuments={setGeneratedDocuments}
    />
    <RecentTranscriptions setPage={setPage} onOpenRecord={onOpenRecord} />
  </>;
}

function UploadPage({
  embedded = false,
  setPage,
  selectedFile,
  audioDuration,
  setSelectedFile,
  setTranscriptionResult,
  setTranscriptText,
  setApiError,
  setAudioDuration,
  setGeneratedDocuments,
}: {
  embedded?: boolean;
  setPage: (page: Page) => void;
  selectedFile: File | null;
  audioDuration: number | null;
  setSelectedFile: (file: File | null) => void;
  setTranscriptionResult: (result: TranscriptionResponse | null) => void;
  setTranscriptText: (text: string) => void;
  setApiError: (error: string | null) => void;
  setAudioDuration: (seconds: number | null) => void;
  setGeneratedDocuments: (documents: { pdf: GeneratedDocument; docx: GeneratedDocument } | null) => void;
}) {
  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    const allowedTypes = [
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/x-m4a",
      "audio/ogg",
      "audio/flac",
    ];
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const allowedExtensions = ["mp3", "wav", "m4a", "ogg", "flac"];

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
      alert("Please select an MP3, WAV, M4A, OGG or FLAC audio file.");
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      alert("Maximum file size is 500 MB.");
      return;
    }

    setSelectedFile(file);
    setTranscriptionResult(null);
    setTranscriptText("");
    setApiError(null);
    setAudioDuration(null);
    setGeneratedDocuments(null);
  };

  const fileSize = selectedFile ? formatFileSize(selectedFile.size) : "";

  return <>
    {!embedded && <FlowSteps current="upload" />}
    <PageHead eyebrow="NEW TRANSCRIPTION" title={embedded ? "Upload audio to transcribe" : "Upload your audio"} description="Select a Tamil audio recording. Your completed transcription will be saved to Recent transcriptions and History." />
    <div className={`narrow ${embedded ? "dashboard-upload" : ""}`}>
      <Card className="upload-card">
        {!selectedFile ? (
          <div
            className="dropzone"
            onClick={() => document.getElementById("audio-file-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileSelect(e.dataTransfer.files?.[0] ?? null);
            }}
          >
            <input
              id="audio-file-input"
              type="file"
              accept=".mp3,.wav,.m4a,.ogg,.flac,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/ogg,audio/flac"
              style={{ display: "none" }}
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />
            <div className="drop-icon"><Icon name="upload" size={28} /></div>
            <h2>Drop your audio file here</h2>
            <p>or click to browse from your computer</p>
            <Button variant="secondary">Choose file</Button>
            <small>MP3, WAV, M4A, OGG or FLAC · Maximum file size 500 MB</small>
          </div>
        ) : (
          <div className="uploaded-file">
            <div className="uploaded-head">
              <div className="audio-file-icon"><Icon name="audio" /></div>
              <div>
                <h2>{selectedFile.name}</h2>
                <p>{fileSize} · {formatDuration(audioDuration)}</p>
              </div>
              <Badge tone="green"><Icon name="check" size={13} /> Ready</Badge>
              <button className="icon-btn" onClick={() => { setSelectedFile(null); setAudioDuration(null); }}>
                <Icon name="close" />
              </button>
            </div>
            <AudioPlayer file={selectedFile} onDurationChange={setAudioDuration} />
          </div>
        )}
      </Card>
      <Card className="language-card">
        <div><Icon name="audio" /><span><strong>Audio language</strong><small>The spoken language in this recording</small></span></div>
        <select><option>தமிழ் (Tamil)</option></select>
      </Card>
      <div className="info-strip"><Icon name="shield" /><span><b>Local audio processing</b><small>Your selected file is sent only to the local FastAPI transcription service running on your computer.</small></span></div>
      <div className="page-actions">
        {!embedded && <Button variant="ghost" onClick={() => setPage("dashboard")}>Cancel</Button>}
        <Button onClick={() => { if (!selectedFile) { alert("Please select an audio file first."); return; } setPage("preprocess"); }}>
          {embedded ? "Start transcription" : "Continue to preprocessing"} <Icon name="arrow" size={17} />
        </Button>
      </div>
    </div>
  </>;
}



function AudioPlayer({
  file,
  onDurationChange,
  playbackRate = 1,
}: {
  file?: File | null;
  onDurationChange?: (seconds: number | null) => void;
  playbackRate?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;

    if (!file || !audio) {
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setAudioError(false);
      onDurationChange?.(null);
      return;
    }

    const url = URL.createObjectURL(file);
    audio.src = url;
    audio.load();
    setPlaying(false);
    setCurrentTime(0);
    setAudioError(false);

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
    };
  }, [file, onDurationChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(nextDuration);
      onDurationChange?.(nextDuration || null);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setPlaying(false);
    const handleError = () => setAudioError(true);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [file, onDurationChange]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !file || audioError) return;

    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setAudioError(true);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  return <div className="audio-player">
    <audio ref={audioRef} preload="metadata" />
    <button className="play-btn" onClick={togglePlayback} disabled={!file || audioError} title={audioError ? "This browser could not play the selected audio" : undefined}>
      <Icon name={playing ? "pause" : "play"} size={18} />
    </button>
    <span>{formatDuration(currentTime)}</span>
    <div className="wave">
      {Array.from({ length: 48 }).map((_, i) => <i key={i} style={{ height: `${10 + ((i * 17) % 27)}px` }} />)}
    </div>
    <span>{formatDuration(duration)}</span>
    <button className="icon-btn"><Icon name="dots" /></button>
  </div>;
}

const processItems = [
  ["Input audio", "Original uploaded file", "check"],
  ["Channel conversion", "Converted to mono when required", "check"],
  ["Sample rate", "Resampled to 16 kHz", "check"],
  ["Normalization", "Audio amplitude normalized", "check"],
] as const;



function PreprocessPage({
  setPage,
  selectedFile,
  audioDuration,
}: {
  setPage: (page: Page) => void;
  selectedFile: File | null;
  audioDuration: number | null;
}) {
  const fileName = selectedFile?.name ?? "No audio selected";
  const fileSize = selectedFile ? formatFileSize(selectedFile.size) : "—";
  return <>
    <FlowSteps current="preprocess" />
    <PageHead eyebrow="AUDIO PREPROCESSING" title="Preparing your audio" description="Standardizing the recording before sending it to IndicWhisper." />
    <div className="narrow">
      <Card className="process-card">
        <div className="process-file"><div className="audio-file-icon"><Icon name="audio" /></div><div><strong>{fileName}</strong><small>{fileSize} · {formatDuration(audioDuration)}</small></div><Badge tone="green">Ready</Badge></div>
        <div className="large-progress"><div><span>Preprocessing settings</span><b>Ready</b></div><i><span style={{ width: "100%" }} /></i><small>The API converts audio to mono, 16 kHz and normalizes its amplitude during transcription.</small></div>
        <div className="process-list">{processItems.map(([name, detail, icon]) => <div key={name}><span className="process-check"><Icon name={icon} size={17} /></span><span><b>{name}</b><small>{detail}</small></span></div>)}</div>
      </Card>
      <div className="info-strip"><Icon name="sparkles" /><span><b>Actual backend preprocessing</b><small>The FastAPI service performs the preprocessing steps before IndicWhisper transcription.</small></span></div>
      <div className="page-actions"><Button variant="ghost" onClick={() => setPage("upload")}>Back</Button><Button onClick={() => { if (!selectedFile) { alert("Please select an audio file first."); setPage("upload"); return; } setPage("transcribing"); }}>Continue to transcription <Icon name="arrow" size={17} /></Button></div>
    </div>
  </>;
}



function TranscribingPage({
  setPage,
  selectedFile,
  audioDuration,
  transcriptionResult,
  setTranscriptionResult,
  setTranscriptText,
  apiError,
  setApiError,
}: {
  setPage: (page: Page) => void;
  selectedFile: File | null;
  audioDuration: number | null;
  transcriptionResult: TranscriptionResponse | null;
  setTranscriptionResult: (result: TranscriptionResponse | null) => void;
  setTranscriptText: (text: string) => void;
  apiError: string | null;
  setApiError: (error: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const transcriptionRequest = useRef<{
    file: File;
    promise: Promise<TranscriptionResponse>;
  } | null>(null);

  useEffect(() => {
    if (!selectedFile || transcriptionResult) return;

    let cancelled = false;
    let requestPromise: Promise<TranscriptionResponse>;

    if (transcriptionRequest.current?.file === selectedFile) {
      requestPromise = transcriptionRequest.current.promise;
    } else {
      requestPromise = transcribeAudio(selectedFile);
      transcriptionRequest.current = { file: selectedFile, promise: requestPromise };
    }

    setLoading(true);
    setApiError(null);

    requestPromise
      .then((result) => {
        if (!cancelled) {
          setTranscriptionResult(result);
          setTranscriptText(result.transcription);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setApiError(error instanceof Error ? error.message : "Unable to transcribe the audio.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFile, transcriptionResult, setApiError, setTranscriptionResult, setTranscriptText]);

  const displayText = transcriptionResult?.transcription ?? "Processing audio with the local IndicWhisper service...";

  return <>
    <FlowSteps current="transcribing" />
    <PageHead eyebrow="AI TRANSCRIPTION" title={transcriptionResult ? "Transcription complete" : "IndicWhisper is transcribing"} description={transcriptionResult ? "The Tamil transcript has been generated successfully." : "Your audio is being processed by the local IndicWhisper service."} />
    <Card className="transcribe-card">
      <div className="ai-status"><div className="ai-orb"><Icon name={transcriptionResult ? "check" : "sparkles"} size={25} /></div><div><h2>{transcriptionResult ? "Transcription completed" : "Listening and transcribing..."}</h2><p>IndicWhisper Tamil · {selectedFile?.name ?? "No file selected"}</p></div><Badge tone={apiError ? "red" : transcriptionResult ? "green" : "blue"}>{apiError ? "Error" : transcriptionResult ? "Completed" : "Processing"}</Badge></div>
      <div className="hero-wave">{Array.from({ length: 88 }).map((_, i) => <i key={i} className={transcriptionResult ? "active" : i % 3 === 0 ? "active" : ""} style={{ height: `${12 + ((i * 23) % 52)}px` }} />)}</div>
      <div className="timeline"><span>{loading ? "Processing" : "Completed"}</span><i><b style={{ width: transcriptionResult ? "100%" : "62%" }} /></i><span>{formatDuration(audioDuration)}</span></div>
      <div className="live-transcript"><div className="live-head"><span><i /> {transcriptionResult ? "FINAL TRANSCRIPT" : "LIVE TRANSCRIPT"}</span><small>{loading ? "Processing audio..." : transcriptionResult ? `Completed · ${formatDuration(audioDuration)}` : "Waiting"}</small></div>{apiError ? <p>{apiError}</p> : <p lang="ta">{displayText}</p>}</div>
    </Card>
    <div className="page-actions"><Button variant="ghost" onClick={() => setPage("preprocess")}>Back</Button><Button onClick={() => transcriptionResult && setPage("editor")}>{transcriptionResult ? "Review transcript" : loading ? "Transcribing..." : "Waiting for transcription"} <Icon name="arrow" size={17} /></Button></div>
  </>;
}



function EditorPage({
  setPage,
  selectedFile,
  audioDuration,
  transcriptionResult,
  text,
  setText,
  saveTranscript,
}: {
  setPage: (page: Page) => void;
  selectedFile: File | null;
  audioDuration: number | null;
  transcriptionResult: TranscriptionResponse | null;
  text: string;
  setText: (text: string) => void;
  saveTranscript: (text: string) => Promise<void>;
}) {
  const [playbackRate, setPlaybackRate] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const fileName = selectedFile?.name ?? transcriptionResult?.filename ?? "Tamil audio";

  const handleApprove = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveTranscript(text);
      setPage("postprocess");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the transcript.");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <FlowSteps current="editor" />
    <PageHead eyebrow="REVIEW & EDIT" title="Review your transcript" description="Listen, edit and verify the AI-generated Tamil text." action={<Badge tone={transcriptionResult ? "green" : "amber"}>{transcriptionResult ? "Transcription received" : "No transcript"}</Badge>} />
    <div className="editor-grid">
      <div>
        <Card className="sticky-player">
          <div className="player-title"><div className="audio-file-icon"><Icon name="audio" /></div><span><b>{fileName}</b><small>{formatDuration(audioDuration)}</small></span></div>
          {selectedFile ? <>
            <AudioPlayer file={selectedFile} playbackRate={playbackRate} />
            <div className="speed-row"><span>Playback speed</span>{[0.75, 1, 1.25, 1.5].map((rate) => <button className={rate === playbackRate ? "active" : ""} key={rate} onClick={() => setPlaybackRate(rate)}>{rate}×</button>)}</div>
          </> : <p className="history-audio-note">This transcript was reopened from history. The original audio file was not archived, so only the saved text is available here.</p>}
        </Card>
        <Card className="confidence-legend"><h3>Transcription result</h3><div><span><i className="high" /> {transcriptionResult ? `Sample rate ${transcriptionResult.sample_rate} Hz` : "Waiting for API result"}</span><span><i className="medium" /> {transcriptionResult ? `${transcriptionResult.channels} channel` : "—"}</span><span><i className="low" /> {transcriptionResult?.device ?? "—"}</span></div></Card>
      </div>
      <Card className="text-editor">
        <div className="editor-toolbar"><div><button><b>B</b></button><button><i>I</i></button><button><u>U</u></button><span /><button>¶</button></div><div><button><Icon name="search" size={17} /> Find & replace</button><button><Icon name="refresh" size={17} /> Undo</button></div></div>
        <div className="segment-label"><span>00:00 — {formatDuration(audioDuration)}</span><Badge tone={transcriptionResult ? "green" : "amber"}>{transcriptionResult ? "API generated" : "Waiting"}</Badge></div>
        <textarea lang="ta" placeholder="Tamil transcription will appear here..." value={text} onChange={(e) => setText(e.target.value)} />
        <div className="editor-footer"><span>{text.length} characters · {wordCount} words</span><span>Tamil Unicode</span></div>
      </Card>
    </div>
    {saveError && <div className="inline-message warning"><Icon name="alert" /> {saveError}</div>}
    <div className="page-actions"><Button variant="ghost" onClick={() => setPage("transcribing")}>Back</Button><Button onClick={handleApprove} disabled={saving}>{saving ? "Saving transcript..." : "Approve & refine"} <Icon name="arrow" size={17} /></Button></div>
  </>;
}



function PostprocessPage({
  setPage,
  text,
  setText,
  saveTranscript,
}: {
  setPage: (page: Page) => void;
  text: string;
  setText: (text: string) => void;
  saveTranscript: (text: string) => Promise<void>;
}) {
  const [applied, setApplied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restorePunctuation, setRestorePunctuation] = useState(true);
  const [unicodeNormalization, setUnicodeNormalization] = useState(true);
  const [whitespaceCleanup, setWhitespaceCleanup] = useState(true);

  const originalText = text;
  let previewText = originalText;
  if (unicodeNormalization) previewText = previewText.normalize("NFC");
  if (whitespaceCleanup) {
    previewText = previewText.replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
  }
  if (restorePunctuation && previewText && !/[.!?…]$/.test(previewText)) {
    previewText += ".";
  }

  const unicodeChanged = originalText !== originalText.normalize("NFC");
  const punctuationAdded = Boolean(originalText.trim() && !/[.!?…]$/.test(originalText.trim()) && /[.!?…]$/.test(previewText));

  const applyRefinements = () => {
    setText(previewText);
    setApplied(true);
  };

  const continueToGenerator = async () => {
    const finalText = applied ? text : previewText;
    if (!finalText.trim()) {
      alert("No transcript is available to generate a document.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      setText(finalText);
      await saveTranscript(finalText);
      setPage("generator");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the refined transcript.");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <FlowSteps current="postprocess" />
    <PageHead eyebrow="POST-PROCESSING" title="Polish the transcript" description="Apply safe text cleanup to the actual AI-generated Tamil transcript." />
    <div className="post-grid">
      <div className="refine-options">
        <Card className="refine-card"><div className="refine-icon"><Icon name="shield" /></div><span><b>Unicode normalization</b><small>Standardize Tamil characters to Unicode NFC format</small></span><label className="switch"><input type="checkbox" checked={unicodeNormalization} onChange={(e) => setUnicodeNormalization(e.target.checked)} /><i /></label></Card>
        <Card className="refine-card"><div className="refine-icon"><Icon name="edit" /></div><span><b>Whitespace cleanup</b><small>Remove repeated spaces and tidy punctuation spacing</small></span><label className="switch"><input type="checkbox" checked={whitespaceCleanup} onChange={(e) => setWhitespaceCleanup(e.target.checked)} /><i /></label></Card>
        <Card className="refine-card"><div className="refine-icon"><Icon name="sparkles" /></div><span><b>Punctuation restoration</b><small>Add a final sentence mark when the transcript does not already have one</small></span><label className="switch"><input type="checkbox" checked={restorePunctuation} onChange={(e) => setRestorePunctuation(e.target.checked)} /><i /></label></Card>
        <Button className="full-btn" icon="sparkles" onClick={applyRefinements}>{applied ? "Refinements applied" : "Apply selected refinements"}</Button>
      </div>
      <Card className="comparison">
        <div className="card-head"><div><h2>Preview changes</h2><p>Showing changes for your actual transcript</p></div><Badge tone={applied ? "green" : "amber"}>{applied ? "Applied" : "Preview"}</Badge></div>
        <div className="compare-block"><span>ORIGINAL</span><p lang="ta">{originalText || "No transcript available."}</p></div>
        <div className="compare-arrow"><Icon name="arrow" /></div>
        <div className="compare-block improved"><span>REFINED</span><p lang="ta">{previewText || "No transcript available."}</p><small>{unicodeNormalization ? "Unicode normalized" : "Unicode normalization off"} · {whitespaceCleanup ? "Whitespace cleaned" : "Whitespace unchanged"} · {restorePunctuation ? "Punctuation checked" : "Punctuation unchanged"}</small></div>
        <div className="change-summary"><div><strong>{unicodeChanged ? 1 : 0}</strong><span>Unicode changes</span></div><div><strong>{whitespaceCleanup ? 1 : 0}</strong><span>Whitespace cleanup</span></div><div><strong>{punctuationAdded && restorePunctuation ? 1 : 0}</strong><span>Punctuation added</span></div></div>
      </Card>
    </div>
    {saveError && <div className="inline-message warning"><Icon name="alert" /> {saveError}</div>}
    <div className="page-actions"><Button variant="ghost" onClick={() => setPage("editor")}>Back to editor</Button><Button onClick={continueToGenerator} disabled={saving}>{saving ? "Saving transcript..." : "Generate document"} <Icon name="arrow" size={17} /></Button></div>
  </>;
}



function GeneratorPage({
  setPage,
  selectedFile,
  sourceFilename,
  text,
  documentTitle,
  setDocumentTitle,
  setGeneratedDocuments,
}: {
  setPage: (page: Page) => void;
  selectedFile: File | null;
  sourceFilename: string;
  text: string;
  documentTitle: string;
  setDocumentTitle: (title: string) => void;
  setGeneratedDocuments: (documents: { pdf: GeneratedDocument; docx: GeneratedDocument } | null) => void;
}) {
  const [department, setDepartment] = useState("தமிழ்நாடு அரசு");
  const [documentDate, setDocumentDate] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("AUTO-GENERATED");
  const [preparedBy, setPreparedBy] = useState("TamilTranscribe Local AI Service");
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    setDocumentDate(new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date()));
    setReferenceNumber("AUTO-GENERATED");
    setPreparedBy("TamilTranscribe Local AI Service");
  }, [selectedFile]);

  const documentText = buildDocumentText({
    title: documentTitle,
    department,
    date: documentDate,
    referenceNumber,
    preparedBy,
    transcript: text,
  });

  const handleGenerate = async () => {
    if (!text.trim()) {
      alert("No transcript is available. Please complete transcription first.");
      return;
    }

    setGenerating(true);
    setGenerationError(null);

    try {
      const [pdf, docx] = await Promise.all([
        generatePdf(documentText, documentTitle, sourceFilename),
        generateDocx(documentText, documentTitle, sourceFilename),
      ]);
      setGeneratedDocuments({ pdf, docx });
      setPage("export");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Document generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  return <>
    <FlowSteps current="generator" />
    <PageHead eyebrow="DOCUMENT GENERATOR" title="Create official document" description="The preview below uses your actual refined Tamil transcript." />
    <div className="generator-grid">
      <Card className="document-form">
        <h2>Document details</h2><p>These editable details are combined with the real transcript for PDF and DOCX generation.</p>
        <label>Document title<input value={documentTitle} onChange={(e) => setDocumentTitle(e.target.value)} lang="ta" /></label>
        <label>Department<input value={department} onChange={(e) => setDepartment(e.target.value)} lang="ta" /></label>
        <div className="form-row"><label>Date<input value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} /></label><label>Reference number<input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} /></label></div>
        <label>Prepared by<input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} /></label>
        <div className="template-choice"><span>Document template</span><div><button className="selected"><Icon name="file" /><b>Official report</b><small>Standard government-style report</small></button><button type="button" disabled><Icon name="file" /><b>Meeting minutes</b><small>Template preview only</small></button></div></div>
        {generationError && <div className="inline-message warning"><Icon name="alert" /> {generationError}</div>}
      </Card>
      <div className="preview-wrap"><div className="preview-label"><span>DOCUMENT PREVIEW</span><span>{text.length} characters</span></div><article className="document-preview" lang="ta"><div className="doc-emblem">தநா</div><b>தமிழ்நாடு அரசு</b><small>{department}</small><hr /><h2>{documentTitle}</h2><div className="doc-meta"><span>நாள்: {documentDate || "—"}</span><span>ந.க.எண்: {referenceNumber}</span></div><h3>படியெழுத்தாக்கம்</h3><p>{text || "Transcript will appear here after the AI transcription step."}</p><div className="signature"><span>{preparedBy}</span><small>{selectedFile?.name ?? "Tamil audio"}</small></div></article></div>
    </div>
    <div className="page-actions"><Button variant="ghost" onClick={() => setPage("postprocess")}>Back</Button><Button onClick={handleGenerate}>{generating ? "Generating PDF & DOCX..." : "Generate document"} <Icon name="arrow" size={17} /></Button></div>
  </>;
}



function ExportPage({
  setPage,
  selectedFile,
  generatedDocuments,
  documentTitle,
}: {
  setPage: (page: Page) => void;
  selectedFile: File | null;
  generatedDocuments: { pdf: GeneratedDocument; docx: GeneratedDocument } | null;
  documentTitle: string;
}) {
  const pdf = generatedDocuments?.pdf;
  const docx = generatedDocuments?.docx;

  return <>
    <FlowSteps current="export" />
    <div className="success-wrap">
      <div className="success-icon"><Icon name="check" size={36} /></div><span className="eyebrow">DOCUMENT READY</span><h1>Your document is ready</h1><p>The PDF and DOCX were generated from your actual Tamil transcript.</p>
      <Card className="export-file"><div className="pdf-icon">PDF</div><div><strong lang="ta">{documentTitle}</strong><small>{pdf ? `Generated just now · ${formatFileSize(pdf.blob.size)}` : "PDF not available"}</small></div><Badge tone={pdf ? "green" : "amber"}><Icon name="check" size={13} /> {pdf ? "Verified" : "Missing"}</Badge></Card>
      <div className="export-options">
        <button onClick={() => pdf && downloadGeneratedDocument(pdf)} disabled={!pdf}><span className="format-icon pdf">PDF</span><span><b>Download PDF</b><small>{pdf ? pdf.filename : "PDF unavailable"}</small></span><Icon name="download" /></button>
        <button onClick={() => docx && downloadGeneratedDocument(docx)} disabled={!docx}><span className="format-icon doc">W</span><span><b>Download DOCX</b><small>{docx ? docx.filename : "DOCX unavailable"}</small></span><Icon name="download" /></button>
      </div>
      <div className="success-actions"><Button variant="secondary" onClick={() => setPage("history")}>View in history</Button><Button icon="plus" onClick={() => setPage("upload")}>New transcription</Button></div>
      <p className="saved-note"><Icon name="folder" size={16} /> Source audio: {selectedFile?.name ?? "—"}</p>
    </div>
  </>;
}



function HistoryPage({
  setPage,
  onOpenRecord,
}: {
  setPage: (page: Page) => void;
  onOpenRecord: (record: HistoryRecord) => void;
}) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchTranscriptionHistory()
      .then((items) => { if (active) setRecords(items); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load transcription history."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const query = search.trim().toLocaleLowerCase();
  const filteredRecords = query
    ? records.filter((record) => `${record.filename} ${record.transcription}`.toLocaleLowerCase().includes(query))
    : records;

  return <>
    <PageHead title="Transcription history" description="Browse and reopen transcripts saved on this computer." action={<Button icon="plus" onClick={() => setPage("upload")}>New transcription</Button>} />
    <Card className="filter-bar">
      <div className="filter-search"><Icon name="search" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search filename or transcript text..." /></div>
      <Button variant="secondary" icon="refresh" onClick={() => setReloadKey((key) => key + 1)}>Refresh</Button>
    </Card>
    <Card className="table-card">
      <div className="card-head"><div><h2>Saved transcriptions</h2><p>{loading ? "Loading local records..." : `${filteredRecords.length} ${filteredRecords.length === 1 ? "record" : "records"}`}</p></div></div>
      <FileTable records={filteredRecords} loading={loading} error={error} onOpen={onOpenRecord} />
    </Card>
    <div className="info-strip"><Icon name="shield" /><span><b>Stored locally</b><small>History is saved in a SQLite database inside your backend project folder. Previously completed demo items are not imported automatically.</small></span></div>
  </>;
}

function formatDocumentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDocumentDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function DocumentsPage({ setPage }: { setPage: (page: Page) => void }) {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState("All formats");
  const [reloadKey, setReloadKey] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchGeneratedDocuments()
      .then((items) => { if (active) setDocuments(items); })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load generated documents.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const query = search.trim().toLocaleLowerCase();
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = !query || `${doc.title} ${doc.filename} ${doc.source_filename}`.toLocaleLowerCase().includes(query);
    const matchesFormat = format === "All formats" || doc.format.toUpperCase() === format;
    return matchesSearch && matchesFormat;
  });

  const handleDownload = async (doc: SavedDocument) => {
    setDownloading(doc.filename);
    setError(null);
    try {
      await downloadSavedDocument(doc.filename);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not download ${doc.filename}.`);
    } finally {
      setDownloading(null);
    }
  };

  return <>
    <PageHead title="Documents" description="Browse and download the real PDF and DOCX files generated from your Tamil transcriptions." action={<Button icon="plus" onClick={() => setPage("upload")}>Create document</Button>} />
    <Card className="filter-bar">
      <div className="filter-search"><Icon name="search" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, filename or source audio..." /></div>
      <select value={format} onChange={(event) => setFormat(event.target.value)} aria-label="Filter by document format">
        <option>All formats</option><option>PDF</option><option>DOCX</option>
      </select>
      <Button variant="secondary" icon="refresh" onClick={() => setReloadKey((key) => key + 1)}>Refresh</Button>
    </Card>

    {error && <div className="inline-message warning" role="alert"><Icon name="alert" /> {error}</div>}
    <div className="card-head document-list-heading"><div><h2>Generated documents</h2><p>{loading ? "Loading saved files..." : `${filteredDocuments.length} ${filteredDocuments.length === 1 ? "document" : "documents"}`}</p></div></div>

    {loading ? (
      <Card className="empty-documents"><div className="state-loader" /><h2>Loading documents</h2><p>Checking the files generated by TamilTranscribe.</p></Card>
    ) : filteredDocuments.length === 0 ? (
      <Card className="empty-documents">
        <div className="state-illustration empty"><Icon name="folder" size={30} /></div>
        <h2>{documents.length === 0 ? "No generated documents yet" : "No matching documents"}</h2>
        <p>{documents.length === 0 ? "After you generate a PDF or DOCX, it will appear here for download." : "Try a different search term or format filter."}</p>
        {documents.length === 0 && <Button icon="plus" onClick={() => setPage("upload")}>Start transcription</Button>}
      </Card>
    ) : (
      <div className="document-grid">
        {filteredDocuments.map((doc) => <Card className="doc-card saved-doc-card" key={doc.filename}>
          <div className={`doc-type ${doc.format.toUpperCase() === "DOCX" ? "word" : ""}`}>{doc.format.toUpperCase()}</div>
          <h3 lang="ta" title={doc.title}>{doc.title || doc.filename}</h3>
          <p>{doc.format.toUpperCase()} · {formatDocumentSize(doc.size_bytes)}</p>
          {doc.source_filename && <p className="saved-doc-source" title={doc.source_filename}>Audio: {doc.source_filename}</p>}
          <div className="saved-doc-footer"><span>{formatDocumentDate(doc.created_at)}</span><button className="icon-btn" disabled={downloading === doc.filename} title={`Download ${doc.format}`} aria-label={`Download ${doc.filename}`} onClick={() => void handleDownload(doc)}><Icon name="download" size={17} /></button></div>
        </Card>)}
      </div>
    )}
  </>;
}

function EvaluationPage() {
  return <>
    <PageHead
      eyebrow="RECORDED BASELINE"
      title="Model evaluation"
      description="Measured IndicWhisper Tamil results from an initial five-sample subset of the Tamil Kathbath validation split."
    />

    <div className="metrics-grid eval-baseline-grid">
      <Card className="metric">
        <div className="metric-icon amber"><Icon name="chart" /></div>
        <span>Word Error Rate (WER)</span>
        <strong>9.8%</strong>
        <small>Lower is better</small>
      </Card>
      <Card className="metric">
        <div className="metric-icon green"><Icon name="chart" /></div>
        <span>Character Error Rate (CER)</span>
        <strong>1.6%</strong>
        <small>Lower is better</small>
      </Card>
      <Card className="metric">
        <div className="metric-icon"><Icon name="audio" /></div>
        <span>Samples evaluated</span>
        <strong>5</strong>
        <small>Tamil validation subset</small>
      </Card>
    </div>

    <Card className="evaluation-detail-card">
      <div className="card-head">
        <div>
          <h2>Evaluation run details</h2>
          <p>Source information for the values shown above</p>
        </div>
        <Badge tone="blue">Initial baseline</Badge>
      </div>
      <div className="evaluation-detail-grid">
        <div><span>Speech recognition model</span><strong>IndicWhisper Tamil</strong></div>
        <div><span>Dataset</span><strong>AI4Bharat Kathbath</strong></div>
        <div><span>Language</span><strong>Tamil</strong></div>
        <div><span>Dataset split</span><strong>Validation subset</strong></div>
        <div><span>Number of samples</span><strong>5 audio samples</strong></div>
        <div><span>Evaluation metrics</span><strong>WER and CER</strong></div>
      </div>
    </Card>

    <Card className="evaluation-caveat-card">
      <div className="evaluation-caveat-icon"><Icon name="alert" size={20} /></div>
      <div>
        <h3>How to interpret these results</h3>
        <p>These are the recorded results from the initial five-sample evaluation: overall WER 9.8% and CER 1.6%. They represent only this small subset and must not be treated as full-dataset benchmark results or as a live accuracy score for each uploaded recording.</p>
        <p>WER measures word-level transcription errors. CER measures character-level transcription errors. More labelled Tamil samples should be evaluated to estimate broader performance reliably.</p>
      </div>
    </Card>
  </>;
}

function SettingsPage() {
  return <>
    <PageHead title="Settings" description="Manage your workspace, transcription and security preferences." />
    <div className="settings-layout">
      <Card className="settings-nav">{[["users", "Profile & workspace"], ["sparkles", "AI transcription"], ["file", "Document defaults"], ["bell", "Notifications"], ["shield", "Security & access"]].map(([icon, label], i) => <button className={i === 1 ? "active" : ""} key={label}><Icon name={icon as IconName} size={18} />{label}<Icon name="chevron" size={16} /></button>)}</Card>
      <Card className="settings-content"><div className="settings-head"><h2>AI transcription</h2><p>Configure default behavior for new transcriptions.</p></div>
        <div className="setting-row"><span><b>Default language</b><small>Language automatically selected for new uploads</small></span><select><option>தமிழ் (Tamil)</option></select></div>
        <div className="setting-row"><span><b>Transcription model</b><small>Choose the AI model used for processing</small></span><select><option>IndicWhisper Tamil — High accuracy</option></select></div>
        <div className="setting-row"><span><b>Automatic preprocessing</b><small>Reduce noise and standardize audio before transcription</small></span><label className="switch"><input type="checkbox" defaultChecked /><i /></label></div>
        <div className="setting-row"><span><b>Auto punctuation</b><small>Restore punctuation in generated Tamil text</small></span><label className="switch"><input type="checkbox" defaultChecked /><i /></label></div>
        <div className="setting-row"><span><b>Confidence highlighting</b><small>Highlight words that may need manual review</small></span><label className="switch"><input type="checkbox" defaultChecked /><i /></label></div>
        <div className="settings-save"><Button>Save changes</Button></div>
      </Card>
    </div>
  </>;
}

function StatesPage({ setPage }: { setPage: (page: Page) => void }) {
  return <>
    <PageHead title="System states" description="Clear, helpful feedback for every moment in the workflow." />
    <div className="states-grid">
      <Card className="state-card"><div className="state-loader" /><h2>Loading transcript</h2><p>Retrieving the latest saved version...</p><div className="skeleton"><i /><i /><i /></div></Card>
      <Card className="state-card"><div className="state-illustration empty"><Icon name="folder" size={30} /></div><h2>No documents yet</h2><p>Generate your first official document from a completed transcription.</p><Button variant="secondary" onClick={() => setPage("upload")}>Start transcription</Button></Card>
      <Card className="state-card"><div className="state-illustration error"><Icon name="alert" size={30} /></div><h2>Upload interrupted</h2><p>We couldn’t finish uploading your file. Your progress has been saved.</p><Button variant="secondary" icon="refresh">Try again</Button></Card>
    </div>
    <Card className="inline-states"><h2>Inline feedback</h2><div><span className="inline-message success"><Icon name="check" /> Changes saved successfully.</span><span className="inline-message warning"><Icon name="alert" /> Audio quality may affect accuracy.</span><span className="inline-message info"><Icon name="sparkles" /> IndicWhisper update available.</span></div></Card>
  </>;
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResponse | null>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [generatedDocuments, setGeneratedDocuments] = useState<{ pdf: GeneratedDocument; docx: GeneratedDocument } | null>(null);
  const [documentTitle, setDocumentTitle] = useState("Tamil Speech Transcription");

  useEffect(() => {
    const sourceName = selectedFile?.name ?? transcriptionResult?.filename;
    const baseName = sourceName ? getBaseFileName(sourceName) : "Tamil Speech Transcription";
    setDocumentTitle(baseName || "Tamil Speech Transcription");
  }, [selectedFile, transcriptionResult?.filename]);

  const openHistoryRecord = (record: HistoryRecord) => {
    setSelectedFile(null);
    setAudioDuration(record.audio_duration_seconds);
    setTranscriptionResult({ ...record, success: true });
    setTranscriptText(record.transcription);
    setApiError(null);
    setGeneratedDocuments(null);
    setDocumentTitle(getBaseFileName(record.filename) || "Tamil Speech Transcription");
    setPage("editor");
  };

  const saveTranscript = async (nextText: string) => {
    const historyId = transcriptionResult?.id;
    if (!historyId) return;
    const updated = await updateTranscriptionHistory(historyId, nextText);
    setTranscriptionResult((current) => current ? { ...current, transcription: updated.transcription } : current);
  };

  const screen = useMemo(() => {
    switch (page) {
      case "dashboard": return <Dashboard
        setPage={setPage}
        selectedFile={selectedFile}
        audioDuration={audioDuration}
        setSelectedFile={setSelectedFile}
        setTranscriptionResult={setTranscriptionResult}
        setTranscriptText={setTranscriptText}
        setApiError={setApiError}
        setAudioDuration={setAudioDuration}
        setGeneratedDocuments={setGeneratedDocuments}
        onOpenRecord={openHistoryRecord}
      />;
      case "upload": return <UploadPage setPage={setPage} selectedFile={selectedFile} audioDuration={audioDuration} setSelectedFile={setSelectedFile} setTranscriptionResult={setTranscriptionResult} setTranscriptText={setTranscriptText} setApiError={setApiError} setAudioDuration={setAudioDuration} setGeneratedDocuments={setGeneratedDocuments} />;
      case "preprocess": return <PreprocessPage setPage={setPage} selectedFile={selectedFile} audioDuration={audioDuration} />;
      case "transcribing": return <TranscribingPage setPage={setPage} selectedFile={selectedFile} audioDuration={audioDuration} transcriptionResult={transcriptionResult} setTranscriptionResult={setTranscriptionResult} setTranscriptText={setTranscriptText} apiError={apiError} setApiError={setApiError} />;
      case "editor": return <EditorPage setPage={setPage} selectedFile={selectedFile} audioDuration={audioDuration} transcriptionResult={transcriptionResult} text={transcriptText} setText={setTranscriptText} saveTranscript={saveTranscript} />;
      case "postprocess": return <PostprocessPage setPage={setPage} text={transcriptText} setText={setTranscriptText} saveTranscript={saveTranscript} />;
      case "generator": return <GeneratorPage setPage={setPage} selectedFile={selectedFile} sourceFilename={selectedFile?.name ?? transcriptionResult?.filename ?? ""} text={transcriptText} documentTitle={documentTitle} setDocumentTitle={setDocumentTitle} setGeneratedDocuments={setGeneratedDocuments} />;
      case "export": return <ExportPage setPage={setPage} selectedFile={selectedFile} generatedDocuments={generatedDocuments} documentTitle={documentTitle} />;
      case "history": return <HistoryPage setPage={setPage} onOpenRecord={openHistoryRecord} />;
      case "documents": return <DocumentsPage setPage={setPage} />;
      case "evaluation": return <EvaluationPage />;
      case "settings": return <SettingsPage />;
      case "states": return <StatesPage setPage={setPage} />;
    }
  }, [page, selectedFile, audioDuration, transcriptionResult, transcriptText, apiError, generatedDocuments, documentTitle]);

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;
  return <Shell page={page} setPage={setPage} onLogout={() => setLoggedIn(false)}>{screen}</Shell>;
}

export default App;
