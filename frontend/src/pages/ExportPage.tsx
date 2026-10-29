import type { Page, AppPreferences } from "../types";
import type { GeneratedDocument } from "../api";
import { Icon } from "../components/ui/Icons";
import {
  Button,
  Card,
  Badge,
  FlowSteps,
} from "../components/ui/UIComponents";
import {
  formatFileSize,
  downloadGeneratedDocument,
} from "../utils/formatters";

export function ExportPage({
  setPage,
  selectedFile,
  generatedDocuments,
  documentTitle,
  preferredFormat,
}: {
  setPage: (page: Page) => void;
  selectedFile: File | null;
  generatedDocuments: {
    pdf: GeneratedDocument;
    docx: GeneratedDocument;
  } | null;
  documentTitle: string;
  preferredFormat: AppPreferences["defaultDocumentFormat"];
}) {
  const pdf = generatedDocuments?.pdf;
  const docx = generatedDocuments?.docx;

  return (
    <>
      <FlowSteps current="export" />
      <div className="success-wrap">
        <div className="success-icon">
          <Icon name="check" size={36} />
        </div>
        <span className="eyebrow">DOCUMENT READY</span>
        <h1>Your document is ready</h1>
        <p>The PDF and DOCX were generated from your actual Tamil transcript.</p>
        <Card className="export-file">
          <div className="pdf-icon">PDF</div>
          <div>
            <strong lang="ta">{documentTitle}</strong>
            <small>
              {pdf
                ? `Generated just now · ${formatFileSize(pdf.blob.size)}`
                : "PDF not available"}
            </small>
          </div>
          <Badge tone={pdf ? "green" : "amber"}>
            <Icon name="check" size={13} /> {pdf ? "Verified" : "Missing"}
          </Badge>
        </Card>
        <div className="export-options">
          {preferredFormat === "PDF" ? (
            <>
              <button
                className="preferred-export"
                onClick={() => pdf && downloadGeneratedDocument(pdf)}
                disabled={!pdf}
              >
                <span className="format-icon pdf">PDF</span>
                <span>
                  <b>
                    Download PDF <em>Preferred</em>
                  </b>
                  <small>{pdf ? pdf.filename : "PDF unavailable"}</small>
                </span>
                <Icon name="download" />
              </button>
              <button
                onClick={() => docx && downloadGeneratedDocument(docx)}
                disabled={!docx}
              >
                <span className="format-icon doc">W</span>
                <span>
                  <b>Download DOCX</b>
                  <small>{docx ? docx.filename : "DOCX unavailable"}</small>
                </span>
                <Icon name="download" />
              </button>
            </>
          ) : (
            <>
              <button
                className="preferred-export"
                onClick={() => docx && downloadGeneratedDocument(docx)}
                disabled={!docx}
              >
                <span className="format-icon doc">W</span>
                <span>
                  <b>
                    Download DOCX <em>Preferred</em>
                  </b>
                  <small>{docx ? docx.filename : "DOCX unavailable"}</small>
                </span>
                <Icon name="download" />
              </button>
              <button
                onClick={() => pdf && downloadGeneratedDocument(pdf)}
                disabled={!pdf}
              >
                <span className="format-icon pdf">PDF</span>
                <span>
                  <b>Download PDF</b>
                  <small>{pdf ? pdf.filename : "PDF unavailable"}</small>
                </span>
                <Icon name="download" />
              </button>
            </>
          )}
        </div>
        <div className="success-actions">
          <Button variant="secondary" onClick={() => setPage("history")}>
            View in history
          </Button>
          <Button icon="plus" onClick={() => setPage("upload")}>
            New transcription
          </Button>
        </div>
        <p className="saved-note">
          <Icon name="folder" size={16} /> Source audio:{" "}
          {selectedFile?.name ?? "—"}
        </p>
      </div>
    </>
  );
}
