import { useEffect, useState } from "react";
import type { Page, AppPreferences } from "../types";
import {
  type HistoryRecord,
  fetchTranscriptionHistory,
  deleteTranscriptionHistory,
} from "../api";
import { Icon } from "../components/ui/Icons";
import { Button, Card, PageHead } from "../components/ui/UIComponents";
import { FileTable } from "./DashboardPage";

export function HistoryPage({
  setPage,
  onOpenRecord,
  preferences,
}: {
  setPage: (page: Page) => void;
  onOpenRecord: (record: HistoryRecord) => void;
  preferences: AppPreferences;
}) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchTranscriptionHistory()
      .then((items) => {
        if (active) setRecords(items);
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

  const handleDelete = async (record: HistoryRecord) => {
    if (preferences.confirmBeforeDelete) {
      const confirmed = window.confirm(
        `Permanently delete this saved transcription?\n\n${record.filename}\n\nThis removes the history record, not separately generated PDF/DOCX files.`,
      );
      if (!confirmed) return;
    }
    setDeletingId(record.id);
    setError(null);
    setNotice(null);
    try {
      await deleteTranscriptionHistory(record.id);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setNotice(`Deleted transcription: ${record.filename}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not delete the transcription record.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const query = search.trim().toLocaleLowerCase();
  const filteredRecords = query
    ? records.filter((record) =>
        `${record.filename} ${record.transcription}`
          .toLocaleLowerCase()
          .includes(query),
      )
    : records;

  return (
    <>
      <PageHead
        title="Transcription history"
        description="Browse, reopen, or delete saved transcripts. Deleting a history record does not remove separately generated documents."
        action={
          <Button icon="plus" onClick={() => setPage("upload")}>
            New transcription
          </Button>
        }
      />
      <Card className="filter-bar">
        <div className="filter-search">
          <Icon name="search" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search filename or transcript text..."
          />
        </div>
        <Button
          variant="secondary"
          icon="refresh"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loading}
        >
          Refresh
        </Button>
      </Card>
      {notice && (
        <div
          className="inline-message success history-feedback"
          role="status"
        >
          <Icon name="check" /> {notice}
        </div>
      )}
      {error && (
        <div
          className="inline-message warning history-feedback"
          role="alert"
        >
          <Icon name="alert" /> {error}
        </div>
      )}
      <Card className="table-card">
        <div className="card-head">
          <div>
            <h2>Saved transcriptions</h2>
            <p>
              {loading
                ? "Loading local records..."
                : `${records.length} saved · ${filteredRecords.length} shown`}
            </p>
          </div>
        </div>
        <FileTable
          records={filteredRecords}
          loading={loading}
          error={null}
          onOpen={onOpenRecord}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      </Card>
      <div className="info-strip">
        <Icon name="shield" />
        <span>
          <b>Stored locally</b>
          <small>
            Deleting removes the selected record from your account's
            SQLite-backed history. It does not delete separately generated files
            on the Documents page.
          </small>
        </span>
      </div>
    </>
  );
}
