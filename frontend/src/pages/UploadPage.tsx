import type { Page } from "../types";
import type {
  TranscriptionResponse,
  GeneratedDocument,
} from "../api";
import { Icon } from "../components/ui/Icons";
import {
  Button,
  Card,
  Badge,
  PageHead,
  FlowSteps,
} from "../components/ui/UIComponents";
import { AudioPlayer } from "../components/AudioPlayer";
import { AudioRecorder } from "../components/AudioRecorder";
import { formatFileSize, formatDuration } from "../utils/formatters";

export function UploadPage({
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
  setGeneratedDocuments: (
    documents: { pdf: GeneratedDocument; docx: GeneratedDocument } | null,
  ) => void;
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

    if (
      !allowedTypes.includes(file.type) &&
      !allowedExtensions.includes(extension)
    ) {
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

  return (
    <>
      {!embedded && <FlowSteps current="upload" />}
      <PageHead
        eyebrow="NEW TRANSCRIPTION"
        title={embedded ? "Upload audio to transcribe" : "Upload your audio"}
        description="Select a Tamil audio recording. Your completed transcription will be saved to Recent transcriptions and History."
      />
      <div className={`narrow ${embedded ? "dashboard-upload" : ""}`}>
        <Card className="upload-card">
          {!selectedFile ? (
            <>
              <div
                className="dropzone"
                onClick={() =>
                  document.getElementById("audio-file-input")?.click()
                }
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
                  onChange={(e) =>
                    handleFileSelect(e.target.files?.[0] ?? null)
                  }
                />
                <div className="drop-icon">
                  <Icon name="upload" size={28} />
                </div>
                <h2>Drop your audio file here</h2>
                <p>or click to browse from your computer</p>
                <Button variant="secondary">Choose file</Button>
                <small>
                  MP3, WAV, M4A, OGG or FLAC · Maximum file size 500 MB
                </small>
              </div>
              <AudioRecorder onRecordingReady={handleFileSelect} />
            </>
          ) : (
            <div className="uploaded-file">
              <div className="uploaded-head">
                <div className="audio-file-icon">
                  <Icon name="audio" />
                </div>
                <div>
                  <h2>{selectedFile.name}</h2>
                  <p>
                    {fileSize} · {formatDuration(audioDuration)}
                  </p>
                </div>
                <Badge tone="green">
                  <Icon name="check" size={13} /> Ready
                </Badge>
                <button
                  className="icon-btn"
                  onClick={() => {
                    setSelectedFile(null);
                    setAudioDuration(null);
                  }}
                >
                  <Icon name="close" />
                </button>
              </div>
              <AudioPlayer
                file={selectedFile}
                onDurationChange={setAudioDuration}
              />
            </div>
          )}
        </Card>
        <Card className="language-card">
          <div>
            <Icon name="audio" />
            <span>
              <strong>Audio language</strong>
              <small>The spoken language in this recording</small>
            </span>
          </div>
          <select>
            <option>தமிழ் (Tamil)</option>
          </select>
        </Card>
        <div className="info-strip">
          <Icon name="shield" />
          <span>
            <b>Local audio processing</b>
            <small>
              Your selected file is sent only to the local FastAPI transcription
              service running on your computer.
            </small>
          </span>
        </div>
        <div className="page-actions">
          {!embedded && (
            <Button variant="ghost" onClick={() => setPage("dashboard")}>
              Cancel
            </Button>
          )}
          <Button
            onClick={() => {
              if (!selectedFile) {
                alert("Please select an audio file first.");
                return;
              }
              setPage("preprocess");
            }}
          >
            {embedded ? "Start transcription" : "Continue to preprocessing"}{" "}
            <Icon name="arrow" size={17} />
          </Button>
        </div>
      </div>
    </>
  );
}
