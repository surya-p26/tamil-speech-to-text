import { useEffect, useState } from "react";
import type { Page } from "../types";
import { type SystemStatus, fetchSystemStatus } from "../api";
import { Icon } from "../components/ui/Icons";
import { Button, Card, Badge, PageHead } from "../components/ui/UIComponents";

export function StatesPage({ setPage }: { setPage: (page: Page) => void }) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchSystemStatus()
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load system status.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const statusTone = (ok: boolean): "green" | "amber" =>
    ok ? "green" : "amber";
  const statusLabel = (ok: boolean) => (ok ? "Ready" : "Check needed");

  return (
    <>
      <PageHead
        title="System status"
        description="Live checks of the backend, speech model, optional punctuation model, document export, and local storage."
        action={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
          >
            {loading ? "Checking…" : "Refresh checks"}
          </Button>
        }
      />
      {error && (
        <div className="inline-message warning system-error">
          <Icon name="alert" /> {error}{" "}
          <span>Make sure FastAPI is running and you are signed in.</span>
        </div>
      )}
      {loading && !status ? (
        <Card className="system-loading">
          <span className="state-loader" /> Checking your local TamilTranscribe
          services…
        </Card>
      ) : (
        status && (
          <>
            <div className="system-status-summary">
              <div>
                <span className="eyebrow">OVERALL STATE</span>
                <h2>
                  {status.status === "healthy"
                    ? "All required services are responding"
                    : "Some checks need attention"}
                </h2>
                <p>
                  Last checked: {new Date(status.checked_at).toLocaleString("en-IN")}
                </p>
              </div>
              <Badge tone={status.status === "healthy" ? "green" : "amber"}>
                {status.status === "healthy" ? "Healthy" : "Degraded"}
              </Badge>
            </div>
            <div className="system-check-grid">
              <Card className="system-check-card">
                <div className="system-check-icon">
                  <Icon name="check" size={20} />
                </div>
                <div className="system-check-heading">
                  <h3>FastAPI backend</h3>
                  <Badge tone="green">Online</Badge>
                </div>
                <p>The authenticated status endpoint responded successfully.</p>
                <small>Backend service: running</small>
              </Card>
              <Card className="system-check-card">
                <div className="system-check-icon">
                  <Icon name="audio" size={20} />
                </div>
                <div className="system-check-heading">
                  <h3>Speech recognition</h3>
                  <Badge
                    tone={statusTone(
                      status.model_loaded && status.model_files_present,
                    )}
                  >
                    {statusLabel(
                      status.model_loaded && status.model_files_present,
                    )}
                  </Badge>
                </div>
                <p>
                  {status.model_name} · {status.device.toUpperCase()} inference
                </p>
                <small>
                  {status.model_loaded
                    ? "Model loaded in memory"
                    : "Model not loaded"}
                  ;{" "}
                  {status.model_files_present
                    ? "model files found"
                    : "model files missing"}
                </small>
              </Card>
              <Card className="system-check-card">
                <div className="system-check-icon">
                  <Icon name="sparkles" size={20} />
                </div>
                <div className="system-check-heading">
                  <h3>Punctuation restoration</h3>
                  <Badge
                    tone={statusTone(status.punctuation_model_files_present)}
                  >
                    {status.punctuation_model_files_present
                      ? "Files found"
                      : "Optional"}
                  </Badge>
                </div>
                <p>{status.punctuation_model_name}</p>
                <small>
                  {status.punctuation_model_files_present
                    ? "Local model directory is present; inference is checked when used."
                    : "Optional feature. First use may download/load the model."}
                </small>
              </Card>
              <Card className="system-check-card">
                <div className="system-check-icon">
                  <Icon name="file" size={20} />
                </div>
                <div className="system-check-heading">
                  <h3>Document generation</h3>
                  <Badge
                    tone={statusTone(
                      status.docx_generator_available &&
                        status.pdf_conversion_package_installed,
                    )}
                  >
                    {status.docx_generator_available &&
                    status.pdf_conversion_package_installed
                      ? "Ready"
                      : "Check needed"}
                  </Badge>
                </div>
                <p>DOCX creation and PDF conversion dependency</p>
                <small>
                  DOCX generator:{" "}
                  {status.docx_generator_available
                    ? "available"
                    : "unavailable"}
                  ; docx2pdf package:{" "}
                  {status.pdf_conversion_package_installed
                    ? "installed"
                    : "missing"}
                  . Word COM is verified when you successfully export a PDF.
                </small>
              </Card>
              <Card className="system-check-card">
                <div className="system-check-icon">
                  <Icon name="folder" size={20} />
                </div>
                <div className="system-check-heading">
                  <h3>Local history storage</h3>
                  <Badge tone={statusTone(status.database_ok)}>
                    {status.database_ok ? "Connected" : "Unavailable"}
                  </Badge>
                </div>
                <p>
                  {status.history_count} saved transcription
                  {status.history_count === 1 ? "" : "s"} ·{" "}
                  {status.documents_count} generated document
                  {status.documents_count === 1 ? "" : "s"}
                </p>
                <small>
                  {status.storage_message} Data remains in the project’s SQLite
                  database.
                </small>
              </Card>
              <Card className="system-check-card">
                <div className="system-check-icon">
                  <Icon name="settings" size={20} />
                </div>
                <div className="system-check-heading">
                  <h3>Audio utilities</h3>
                  <Badge tone={statusTone(status.ffmpeg_available)}>
                    {status.ffmpeg_available
                      ? "FFmpeg found"
                      : "FFmpeg not found"}
                  </Badge>
                </div>
                <p>Audio conversion tools</p>
                <small>
                  {status.ffmpeg_available
                    ? "FFmpeg is available on PATH."
                    : "FFmpeg is not detected on PATH. Existing supported formats may still work through the Python audio libraries."}
                </small>
              </Card>
            </div>
            <div className="info-strip">
              <Icon name="shield" />
              <span>
                <b>Diagnostics do not change your data</b>
                <small>
                  These checks only read service and storage status. Use
                  Settings to change local UI preferences; model files and
                  transcription history are not modified by refreshing status.
                </small>
              </span>
            </div>
          </>
        )
      )}
      <div className="system-actions">
        <Button variant="secondary" onClick={() => setPage("settings")}>
          Open settings
        </Button>
        <Button onClick={() => setPage("upload")}>Start transcription</Button>
      </div>
    </>
  );
}
