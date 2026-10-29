import type { Page } from "../types";
import { Icon } from "../components/ui/Icons";
import {
  Button,
  Card,
  Badge,
  PageHead,
  FlowSteps,
} from "../components/ui/UIComponents";
import { formatFileSize, formatDuration } from "../utils/formatters";

export const processItems = [
  ["Input audio", "Original uploaded file", "check"],
  ["Channel conversion", "Converted to mono when required", "check"],
  ["Sample rate", "Resampled to 16 kHz", "check"],
  ["Normalization", "Audio amplitude normalized", "check"],
] as const;

export function PreprocessPage({
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

  return (
    <>
      <FlowSteps current="preprocess" />
      <PageHead
        eyebrow="AUDIO PREPROCESSING"
        title="Preparing your audio"
        description="Standardizing the recording before sending it to IndicWhisper."
      />
      <div className="narrow">
        <Card className="process-card">
          <div className="process-file">
            <div className="audio-file-icon">
              <Icon name="audio" />
            </div>
            <div>
              <strong>{fileName}</strong>
              <small>
                {fileSize} · {formatDuration(audioDuration)}
              </small>
            </div>
            <Badge tone="green">Ready</Badge>
          </div>
          <div className="large-progress">
            <div>
              <span>Preprocessing settings</span>
              <b>Ready</b>
            </div>
            <i>
              <span style={{ width: "100%" }} />
            </i>
            <small>
              The API converts audio to mono, 16 kHz and normalizes its amplitude
              during transcription.
            </small>
          </div>
          <div className="process-list">
            {processItems.map(([name, detail, icon]) => (
              <div key={name}>
                <span className="process-check">
                  <Icon name={icon} size={17} />
                </span>
                <span>
                  <b>{name}</b>
                  <small>{detail}</small>
                </span>
              </div>
            ))}
          </div>
        </Card>
        <div className="info-strip">
          <Icon name="sparkles" />
          <span>
            <b>Actual backend preprocessing</b>
            <small>
              The FastAPI service performs the preprocessing steps before
              IndicWhisper transcription.
            </small>
          </span>
        </div>
        <div className="page-actions">
          <Button variant="ghost" onClick={() => setPage("upload")}>
            Back
          </Button>
          <Button
            onClick={() => {
              if (!selectedFile) {
                alert("Please select an audio file first.");
                setPage("upload");
                return;
              }
              setPage("transcribing");
            }}
          >
            Continue to transcription <Icon name="arrow" size={17} />
          </Button>
        </div>
      </div>
    </>
  );
}
