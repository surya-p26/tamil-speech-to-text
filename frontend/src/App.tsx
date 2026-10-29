import { useEffect, useMemo, useState } from "react";
import {
  type AuthUser,
  type HistoryRecord,
  type TranscriptionResponse,
  type GeneratedDocument,
  fetchCurrentUser,
  logoutUser,
  clearAuthSession,
  updateTranscriptionHistory,
} from "./api";
import {
  type Page,
  type AppPreferences,
  PREFERENCES_STORAGE_KEY,
  readAppPreferences,
} from "./types";
import { Logo } from "./components/ui/UIComponents";
import { Shell } from "./components/Shell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { UploadPage } from "./pages/UploadPage";
import { PreprocessPage } from "./pages/PreprocessPage";
import { TranscribingPage } from "./pages/TranscribingPage";
import { EditorPage } from "./pages/EditorPage";
import { PostprocessPage } from "./pages/PostprocessPage";
import { GeneratorPage } from "./pages/GeneratorPage";
import { ExportPage } from "./pages/ExportPage";
import { HistoryPage } from "./pages/HistoryPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StatesPage } from "./pages/StatesPage";
import { getBaseFileName } from "./utils/formatters";

function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [transcriptionResult, setTranscriptionResult] =
    useState<TranscriptionResponse | null>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [generatedDocuments, setGeneratedDocuments] = useState<{
    pdf: GeneratedDocument;
    docx: GeneratedDocument;
  } | null>(null);
  const [documentTitle, setDocumentTitle] = useState(
    "Tamil Speech Transcription",
  );
  const [preferences, setPreferences] = useState<AppPreferences>(() =>
    readAppPreferences(),
  );

  useEffect(() => {
    const sourceName = selectedFile?.name ?? transcriptionResult?.filename;
    const baseName = sourceName
      ? getBaseFileName(sourceName)
      : "Tamil Speech Transcription";
    setDocumentTitle(baseName || "Tamil Speech Transcription");
  }, [selectedFile, transcriptionResult?.filename]);

  useEffect(() => {
    document.title = "Tamil Speech to Text";
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences),
      );
    } catch {
      /* Preferences remain usable for this session if storage is blocked. */
    }
    document.documentElement.classList.toggle(
      "tt-compact",
      preferences.compactLayout,
    );
    return () => document.documentElement.classList.remove("tt-compact");
  }, [preferences]);

  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then((user) => {
        if (active) setCurrentUser(user);
      })
      .catch(() => {
        /* The API wrapper clears the session on 401; keep it on transient network errors. */
      })
      .finally(() => {
        if (active) setAuthChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null);
      setAuthChecked(true);
    };
    window.addEventListener("tamiltranscribe:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener(
        "tamiltranscribe:unauthorized",
        handleUnauthorized,
      );
  }, []);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      clearAuthSession();
    }
    setCurrentUser(null);
    setPage("dashboard");
  };

  const openHistoryRecord = (record: HistoryRecord) => {
    setSelectedFile(null);
    setAudioDuration(record.audio_duration_seconds);
    setTranscriptionResult({ ...record, success: true });
    setTranscriptText(record.transcription);
    setApiError(null);
    setGeneratedDocuments(null);
    setDocumentTitle(
      getBaseFileName(record.filename) || "Tamil Speech Transcription",
    );
    setPage("editor");
  };

  const saveTranscript = async (nextText: string) => {
    const historyId = transcriptionResult?.id;
    if (!historyId) return;
    const updated = await updateTranscriptionHistory(historyId, nextText);
    setTranscriptionResult((current) =>
      current ? { ...current, transcription: updated.transcription } : current,
    );
  };

  const screen = useMemo(() => {
    switch (page) {
      case "dashboard":
        return (
          <DashboardPage
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
          />
        );
      case "upload":
        return (
          <UploadPage
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
        );
      case "preprocess":
        return (
          <PreprocessPage
            setPage={setPage}
            selectedFile={selectedFile}
            audioDuration={audioDuration}
          />
        );
      case "transcribing":
        return (
          <TranscribingPage
            setPage={setPage}
            selectedFile={selectedFile}
            audioDuration={audioDuration}
            transcriptionResult={transcriptionResult}
            setTranscriptionResult={setTranscriptionResult}
            setTranscriptText={setTranscriptText}
            apiError={apiError}
            setApiError={setApiError}
          />
        );
      case "editor":
        return (
          <EditorPage
            setPage={setPage}
            selectedFile={selectedFile}
            audioDuration={audioDuration}
            transcriptionResult={transcriptionResult}
            text={transcriptText}
            setText={setTranscriptText}
            saveTranscript={saveTranscript}
          />
        );
      case "postprocess":
        return (
          <PostprocessPage
            setPage={setPage}
            text={transcriptText}
            setText={setTranscriptText}
            saveTranscript={saveTranscript}
          />
        );
      case "generator":
        return (
          <GeneratorPage
            setPage={setPage}
            selectedFile={selectedFile}
            sourceFilename={
              selectedFile?.name ?? transcriptionResult?.filename ?? ""
            }
            text={transcriptText}
            documentTitle={documentTitle}
            setDocumentTitle={setDocumentTitle}
            setGeneratedDocuments={setGeneratedDocuments}
          />
        );
      case "export":
        return (
          <ExportPage
            setPage={setPage}
            selectedFile={selectedFile}
            generatedDocuments={generatedDocuments}
            documentTitle={documentTitle}
            preferredFormat={preferences.defaultDocumentFormat}
          />
        );
      case "history":
        return (
          <HistoryPage
            setPage={setPage}
            onOpenRecord={openHistoryRecord}
            preferences={preferences}
          />
        );
      case "documents":
        return <DocumentsPage setPage={setPage} />;
      case "evaluation":
        return <EvaluationPage />;
      case "settings":
        return (
          <SettingsPage preferences={preferences} onSave={setPreferences} />
        );
      case "states":
        return <StatesPage setPage={setPage} />;
    }
  }, [
    page,
    selectedFile,
    audioDuration,
    transcriptionResult,
    transcriptText,
    apiError,
    generatedDocuments,
    documentTitle,
    preferences,
  ]);

  if (!authChecked) {
    return (
      <main className="auth-loading">
        <div className="auth-loading-mark">
          <Logo compact />
        </div>
        <strong>Checking your secure session…</strong>
        <span>Connecting to TamilTranscribe</span>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <LoginPage
        onLogin={(user) => {
          setCurrentUser(user);
          setPage("dashboard");
        }}
      />
    );
  }

  return (
    <Shell
      page={page}
      setPage={setPage}
      user={currentUser}
      onLogout={() => {
        void handleLogout();
      }}
    >
      {screen}
    </Shell>
  );
}

export default App;
