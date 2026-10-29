import { useEffect, useState } from "react";
import type { Page } from "../types";
import {
  type HistoryRecord,
  type TranscriptionResponse,
  type GeneratedDocument,
  fetchTranscriptionHistory,
} from "../api";
import { Icon } from "../components/ui/Icons";
import { Button, Card, Badge } from "../components/ui/UIComponents";
import { UploadPage } from "./UploadPage";
import {
  formatDuration,
  formatHistoryDate,
} from "../utils/formatters";

export function FileTable({
  records,
  onOpen,
  onDelete,
  deletingId = null,
  loading = false,
  error = null,
}: {
  records: HistoryRecord[];
  onOpen: (record: HistoryRecord) => void;
  onDelete?: (record: HistoryRecord) => void;
  deletingId?: string | null;
  loading?: boolean;
  error?: string | null;
}) {
  if (loading) {
    return (
      <div className="history-message">
        <span className="state-loader" />
        Loading saved transcriptions...
      </div>
    );
  }
  if (error) {
    return (
      <div className="history-message inline-message warning">
        <Icon name="alert" /> {error}
      </div>
    );
  }
  if (!records.length) {
    return (
      <div className="history-empty">
        <div className="state-illustration empty">
          <Icon name="audio" size={28} />
        </div>
        <h3>No transcriptions yet</h3>
        <p>
          Upload a Tamil audio file above. Completed transcriptions will appear
          here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="file-table file-table-history">
      <div className="table-row table-header">
        <span>FILE NAME</span>
        <span>DATE</span>
        <span>DURATION</span>
        <span>STATUS</span>
        <span>TRANSCRIPT PREVIEW</span>
        <span />
      </div>
      {records.map((record) => (
        <div
          className="table-row history-data-row"
          key={record.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(record)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen(record);
            }
          }}
          title="Open this saved transcript"
        >
          <span className="file-name">
            <i>
              <Icon name="audio" size={18} />
            </i>
            <span>
              <b lang="ta">{record.filename}</b>
              <small>{record.model || "Tamil audio transcription"}</small>
            </span>
          </span>
          <span>{formatHistoryDate(record.created_at)}</span>
          <span>{formatDuration(record.audio_duration_seconds)}</span>
          <span>
            <Badge tone="green">
              <Icon name="check" size={12} /> {record.status || "Completed"}
            </Badge>
          </span>
          <span className="history-preview" lang="ta">
            {record.transcription?.trim()
              ? record.transcription.length > 82
                ? `${record.transcription.slice(0, 82)}…`
                : record.transcription
              : "No transcript text"}
          </span>
          <span className="history-row-actions">
            <button
              className="icon-btn"
              title="Open transcript"
              aria-label={`Open ${record.filename}`}
              onClick={(event) => {
                event.stopPropagation();
                onOpen(record);
              }}
            >
              <Icon name="chevron" />
            </button>
            {onDelete && (
              <button
                className="icon-btn delete-history-btn"
                title="Delete saved transcription"
                aria-label={`Delete ${record.filename}`}
                disabled={deletingId === record.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(record);
                }}
              >
                <Icon name="trash" />
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RecentTranscriptions({
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
      .then((items) => {
        if (active) setRecords(items.slice(0, 6));
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load transcription history.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <Card className="table-card recent-transcriptions-card">
      <div className="card-head">
        <div>
          <h2>Recent transcriptions</h2>
          <p>Your latest completed audio transcriptions</p>
        </div>
        <div className="recent-actions">
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Refresh
          </Button>
          <Button variant="ghost" onClick={() => setPage("history")}>
            View history <Icon name="arrow" size={16} />
          </Button>
        </div>
      </div>
      <FileTable
        records={records}
        loading={loading}
        error={error}
        onOpen={onOpenRecord}
      />
    </Card>
  );
}

export function DashboardPage({
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
  setGeneratedDocuments: (
    documents: { pdf: GeneratedDocument; docx: GeneratedDocument } | null,
  ) => void;
  onOpenRecord: (record: HistoryRecord) => void;
}) {
  return (
    <>
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
    </>
  );
}
