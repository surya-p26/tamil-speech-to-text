import { useEffect, useState } from "react";
import type { Page } from "../types";
import {
  type GeneratedDocument,
  generatePdf,
  generateDocx,
} from "../api";
import { Icon } from "../components/ui/Icons";
import {
  Button,
  Card,
  PageHead,
  FlowSteps,
} from "../components/ui/UIComponents";
import { buildDocumentText } from "../utils/formatters";
import { TAMIL_NADU_DISTRICTS, TALUKS_BY_DISTRICT } from "../utils/constants";

export function GeneratorPage({
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
  setGeneratedDocuments: (
    documents: { pdf: GeneratedDocument; docx: GeneratedDocument } | null,
  ) => void;
}) {
  const [department, setDepartment] = useState("தமிழ்நாடு அரசு");
  const [district, setDistrict] = useState("");
  const [taluk, setTaluk] = useState("");
  const [manualTaluk, setManualTaluk] = useState("");
  const [officeType, setOfficeType] = useState(
    "தாலுகா அலுவலகம் / Taluk Office",
  );
  const [officeName, setOfficeName] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [designation, setDesignation] = useState("");
  const [subject, setSubject] = useState("");
  const [templateName, setTemplateName] = useState<
    "official_report" | "meeting_minutes"
  >("official_report");
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setDocumentDate(now.toISOString().slice(0, 10));
    setReferenceNumber(
      `TT/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/001`,
    );
    setSubject(documentTitle || "தமிழ் உரையாக்க அறிக்கை");
  }, [selectedFile, documentTitle]);

  const talukOptions = TALUKS_BY_DISTRICT[district] || [];
  const resolvedTaluk = taluk === "__other__" ? manualTaluk : taluk;
  const resolvedOffice = [officeType, officeName.trim()]
    .filter(Boolean)
    .join(" — ");
  const metadata = {
    department,
    district,
    taluk: resolvedTaluk,
    office_name: resolvedOffice,
    date: documentDate,
    reference_number: referenceNumber,
    prepared_by: preparedBy,
    designation,
    subject: subject || documentTitle,
    template_name: templateName,
  };
  const transcriptParagraphs = text
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const displayDate = documentDate
    ? new Date(`${documentDate}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  const handleGenerate = async () => {
    if (!text.trim()) {
      setGenerationError(
        "No transcript is available. Complete transcription and refinement first.",
      );
      return;
    }
    if (!documentTitle.trim()) {
      setGenerationError("Enter a document title before generating.");
      return;
    }
    setGenerating(true);
    setGenerationError(null);
    try {
      const documentText = buildDocumentText({
        title: documentTitle,
        department,
        date: displayDate,
        referenceNumber,
        preparedBy: [preparedBy, designation].filter(Boolean).join(" — "),
        transcript: text,
      });
      const [pdf, docx] = await Promise.all([
        generatePdf(text, documentTitle, sourceFilename, metadata),
        generateDocx(documentText, documentTitle, sourceFilename),
      ]);
      setGeneratedDocuments({ pdf, docx });
      setPage("export");
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "Document generation failed.",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <FlowSteps current="generator" />
      <PageHead
        eyebrow="DOCUMENT GENERATOR"
        title="Create a Tamil Nadu government-style draft"
        description="Configure office details and review the print-ready Tamil document before downloading."
      />
      <div className="generator-layout">
        <Card className="document-form">
          <h2>Document details</h2>
          <p className="form-intro">
            These details appear in the PDF header and reference block.
            Generated documents are marked as drafts until reviewed and
            officially issued.
          </p>
          <label>
            Document title
            <input
              required
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              lang="ta"
              placeholder="அதிகாரப்பூர்வ அரசு அறிக்கை"
            />
          </label>
          <label>
            Department / துறை
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              lang="ta"
              placeholder="எ.கா. வருவாய்த் துறை"
            />
          </label>
          <label>
            Office type / அலுவலக வகை
            <select
              value={officeType}
              onChange={(e) => setOfficeType(e.target.value)}
            >
              <option>மாவட்ட ஆட்சியர் அலுவலகம் / Collectorate</option>
              <option>
                வருவாய் கோட்டாட்சியர் அலுவலகம் / Revenue Divisional Office
              </option>
              <option>தாலுகா அலுவலகம் / Taluk Office</option>
              <option>
                கிராம நிர்வாக அலுவலகம் / Village Administrative Office
              </option>
              <option>ஊராட்சி ஒன்றிய அலுவலகம் / Panchayat Union</option>
              <option>மாநகராட்சி / Municipal Corporation</option>
              <option>நகராட்சி / Municipality</option>
              <option>பேரூராட்சி / Town Panchayat</option>
              <option>துறை அலுவலகம் / Department Office</option>
              <option>பிற அலுவலகம் / Other Office</option>
            </select>
          </label>
          <label>
            Office name / அலுவலகத்தின் பெயர்
            <input
              value={officeName}
              onChange={(e) => setOfficeName(e.target.value)}
              lang="ta"
              placeholder="எ.கா. அலுவலகம் அல்லது பிரிவு பெயர்"
            />
          </label>
          <div className="field-grid">
            <label>
              District / மாவட்டம்
              <select
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setTaluk("");
                  setManualTaluk("");
                }}
              >
                <option value="">
                  மாவட்டத்தைத் தேர்ந்தெடுக்கவும் / Select district
                </option>
                {TAMIL_NADU_DISTRICTS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Taluk / வட்டம்
              <select
                value={taluk}
                onChange={(e) => setTaluk(e.target.value)}
                disabled={!district}
              >
                <option value="">
                  வட்டத்தைத் தேர்ந்தெடுக்கவும் / Select taluk
                </option>
                {talukOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value="__other__">Other / கைமுறையாக உள்ளிடவும்</option>
              </select>
            </label>
            {taluk === "__other__" && (
              <label>
                Taluk name / வட்டத்தின் பெயர்
                <input
                  value={manualTaluk}
                  onChange={(e) => setManualTaluk(e.target.value)}
                  lang="ta"
                  placeholder="வட்டத்தின் பெயரை உள்ளிடவும்"
                />
              </label>
            )}
            <label>
              Date / நாள்
              <input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
              />
            </label>
            <label>
              Reference number
              <input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="TT/2026/10/001"
              />
            </label>
          </div>
          <label>
            Subject / பொருள்
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              lang="ta"
              placeholder="ஆவணத்தின் பொருள்"
            />
          </label>
          <div className="field-grid">
            <label>
              Prepared by
              <input
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="பெயர்"
              />
            </label>
            <label>
              Designation / பதவி
              <input
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                lang="ta"
                placeholder="பதவி"
              />
            </label>
          </div>
          <div className="template-choice">
            <span>Document template / ஆவண வகை</span>
            <div>
              <button
                type="button"
                className={
                  templateName === "official_report" ? "selected" : ""
                }
                onClick={() => setTemplateName("official_report")}
                aria-pressed={templateName === "official_report"}
              >
                <Icon name="file" size={18} />
                <b>Official report</b>
                <small>Subject, report body and signature block</small>
              </button>
              <button
                type="button"
                className={
                  templateName === "meeting_minutes" ? "selected" : ""
                }
                onClick={() => setTemplateName("meeting_minutes")}
                aria-pressed={templateName === "meeting_minutes"}
              >
                <Icon name="users" size={18} />
                <b>Meeting minutes</b>
                <small>Meeting notes and record layout</small>
              </button>
            </div>
          </div>
          {generationError && (
            <div className="inline-message warning" role="alert">
              <Icon name="alert" /> {generationError}
            </div>
          )}
        </Card>

        <div className="generator-preview">
          <div className="preview-label">
            <span>LIVE DOCUMENT PREVIEW</span>
            <span>{text.length} characters · A4</span>
          </div>
          <div className="preview-scroll">
            <article className="document-preview" lang="ta">
              <div className="doc-header">
                <div className="draft-ribbon">வரைவு · DRAFT DOCUMENT</div>
                <div
                  className="doc-emblem"
                  aria-label="Tamil Nadu state emblem"
                >
                  <img
                    src="/tamil-nadu-emblem.png"
                    alt="Tamil Nadu state emblem"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                </div>
                <h2>தமிழ்நாடு அரசு</h2>
                <div className="doc-english">GOVERNMENT OF TAMIL NADU</div>
                <div className="doc-dept">
                  {department || "துறை / Department"}
                </div>
                <div className="doc-office">
                  {resolvedOffice || "அலுவலகம் / Office"}
                </div>
              </div>
              <div className="doc-meta">
                <div>
                  <b>நாள் / DATE</b>
                  {displayDate}
                </div>
                <div>
                  <b>ந.க.எண் / REFERENCE</b>
                  {referenceNumber || "—"}
                </div>
                <div>
                  <b>மாவட்டம் / DISTRICT</b>
                  {district || "—"}
                </div>
                <div>
                  <b>வட்டம் / TALUK</b>
                  {resolvedTaluk || "—"}
                </div>
              </div>
              <div className="doc-subject">
                <b>பொருள் / SUBJECT</b>
                <strong>{subject || documentTitle || "—"}</strong>
              </div>
              <div className="doc-section-title">
                {templateName === "meeting_minutes"
                  ? "கூட்டக் குறிப்புகள் / MEETING MINUTES"
                  : "செயல்முறை ஆணை மற்றும் அறிக்கை விவரம் / REPORT DETAILS"}
              </div>
              {transcriptParagraphs.length ? (
                transcriptParagraphs.map((paragraph, index) => (
                  <p
                    className="doc-body"
                    key={`${index}-${paragraph.slice(0, 12)}`}
                  >
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="doc-body">
                  திருத்தப்பட்ட தமிழ் உரை இங்கு தோன்றும்.
                </p>
              )}
              <div className="doc-signature">
                <div className="signature-line" />
                <b>கையொப்பம் / Signature</b>
                <div>{preparedBy || "பெயர் / Name"}</div>
                <div>{designation || "பதவி / Designation"}</div>
                <small>வரைவு ஆவணம் · DRAFT DOCUMENT</small>
              </div>
              <div className="doc-footer">
                தமிழ்நாடு அரசு மின்னாளுமை முகமை · Tamil Nadu e-Governance
                Agency
                <br />
                Verified Unicode text · Draft — not an issued government order
              </div>
            </article>
          </div>
        </div>
      </div>
      <div className="generator-actions">
        <Button variant="ghost" onClick={() => setPage("postprocess")}>
          Back
        </Button>
        <div>
          <Button variant="secondary" onClick={() => window.print()}>
            <Icon name="file" size={16} /> Print preview
          </Button>
          <Button
            onClick={() => void handleGenerate()}
            disabled={generating}
          >
            {generating ? "Generating PDF & DOCX…" : "Generate PDF & DOCX"}
            <Icon name="arrow" size={17} />
          </Button>
        </div>
      </div>
    </>
  );
}
