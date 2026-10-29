import { useEffect, useRef, useState } from "react";
import type { Page } from "../types";
import {
  type TranscriptionResponse,
  type TranscriptionProgress,
  transcribeAudio,
} from "../api";
import { Icon } from "../components/ui/Icons";
import {
  Button,
  Card,
  Badge,
  PageHead,
  FlowSteps,
} from "../components/ui/UIComponents";
import { formatDuration } from "../utils/formatters";

export function TranscribingPage({
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
  const [progress, setProgress] = useState<TranscriptionProgress>({
    percent: 0,
    stage: "uploading",
    label: "Waiting to upload",
    message: "Preparing your audio for secure local processing.",
  });
  const transcriptionRequest = useRef<{
    file: File;
    promise: Promise<TranscriptionResponse>;
  } | null>(null);
  const progressCallbackRef = useRef<(nextProgress: TranscriptionProgress) => void>(
    () => {},
  );

  useEffect(() => {
    if (!selectedFile || transcriptionResult) return;

    let cancelled = false;
    let requestPromise: Promise<TranscriptionResponse>;
    progressCallbackRef.current = (nextProgress) => {
      if (!cancelled) setProgress(nextProgress);
    };

    setLoading(true);
    setApiError(null);
    setProgress({
      percent: 0,
      stage: "uploading",
      label: "Uploading audio",
      message: "Sending your audio to the local transcription service.",
    });

    if (transcriptionRequest.current?.file === selectedFile) {
      requestPromise = transcriptionRequest.current.promise;
    } else {
      requestPromise = transcribeAudio(selectedFile, (nextProgress) => {
        progressCallbackRef.current(nextProgress);
      });
      transcriptionRequest.current = {
        file: selectedFile,
        promise: requestPromise,
      };
    }

    requestPromise
      .then((result) => {
        if (!cancelled) {
          setTranscriptionResult(result);
          setTranscriptText(result.transcription);
          setProgress({
            percent: 100,
            stage: "completed",
            label: "Completed",
            message: "Transcription is complete and saved to your history.",
          });
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to transcribe the audio.";
          setApiError(message);
          setProgress((current) => ({
            ...current,
            stage: "failed",
            label: "Transcription failed",
            message,
          }));
          if (transcriptionRequest.current?.file === selectedFile) {
            transcriptionRequest.current = null;
          }
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedFile,
    transcriptionResult,
    setApiError,
    setTranscriptionResult,
    setTranscriptText,
  ]);

  const displayText =
    transcriptionResult?.transcription ??
    "Processing audio with the local IndicWhisper service...";

  return (
    <>
      <FlowSteps current="transcribing" />
      <PageHead
        eyebrow="AI TRANSCRIPTION"
        title={
          transcriptionResult
            ? "Transcription complete"
            : apiError
              ? "Transcription interrupted"
              : progress.label
        }
        description={
          transcriptionResult
            ? "The Tamil transcript has been generated successfully."
            : apiError
              ? "The transcription could not be completed. Check the error below and try again."
              : progress.message
        }
      />
      <Card className="transcribe-card">
        <div className="ai-status">
          <div className="ai-orb">
            <Icon
              name={
                transcriptionResult
                  ? "check"
                  : apiError
                    ? "alert"
                    : "sparkles"
              }
              size={25}
            />
          </div>
          <div>
            <h2>
              {transcriptionResult
                ? "Transcription completed"
                : apiError
                  ? "Transcription failed"
                  : progress.label}
            </h2>
            <p>IndicWhisper Tamil · {selectedFile?.name ?? "No file selected"}</p>
          </div>
          <Badge
            tone={
              apiError ? "red" : transcriptionResult ? "green" : "blue"
            }
          >
            {apiError
              ? "Error"
              : transcriptionResult
                ? "Completed"
                : "Processing"}
          </Badge>
        </div>
        <div className="hero-wave">
          {Array.from({ length: 88 }).map((_, i) => (
            <i
              key={i}
              className={
                transcriptionResult ? "active" : i % 3 === 0 ? "active" : ""
              }
              style={{ height: `${12 + ((i * 23) % 52)}px` }}
            />
          ))}
        </div>
        <div className="timeline transcription-timeline">
          <span>{transcriptionResult ? "Completed" : progress.label}</span>
          <div
            className={`transcription-progress-track${loading && progress.stage === "transcribing" ? " is-indeterminate" : ""}${apiError ? " has-error" : ""}`}
            role="progressbar"
            aria-label="Tamil transcription progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={transcriptionResult ? 100 : progress.percent}
            aria-valuetext={
              transcriptionResult
                ? "Transcription completed"
                : `${progress.percent}% — ${progress.label}`
            }
          >
            <span
              className="transcription-progress-fill"
              style={{
                width: `${transcriptionResult ? 100 : progress.percent}%`,
              }}
            />
            {loading && progress.stage === "transcribing" && (
              <span
                className="transcription-progress-activity"
                style={{
                  left: `${progress.percent}%`,
                  width: `${Math.max(0, 100 - progress.percent)}%`,
                }}
                aria-hidden="true"
              >
                <i />
              </span>
            )}
          </div>
          <strong>{transcriptionResult ? 100 : progress.percent}%</strong>
        </div>
        <div className="progress-caption">
          <span>{apiError ? apiError : progress.message}</span>
          <span>Audio duration · {formatDuration(audioDuration)}</span>
        </div>
        <div className="live-transcript">
          <div className="live-head">
            <span>
              <i />{" "}
              {transcriptionResult ? "FINAL TRANSCRIPT" : "TRANSCRIPT RESULT"}
            </span>
            <small>
              {loading
                ? progress.label
                : transcriptionResult
                  ? `Completed · ${formatDuration(audioDuration)}`
                  : apiError
                    ? "Needs attention"
                    : "Waiting"}
            </small>
          </div>
          {apiError ? (
            <p>{apiError}</p>
          ) : (
            <p lang="ta">{displayText}</p>
          )}
        </div>
      </Card>
      <div className="page-actions">
        <Button variant="ghost" onClick={() => setPage("preprocess")}>
          Back
        </Button>
        <Button
          disabled={loading || (!transcriptionResult && !apiError)}
          onClick={() => {
            if (transcriptionResult) setPage("editor");
            else if (apiError) {
              setApiError(null);
              setPage("preprocess");
            }
          }}
        >
          {transcriptionResult
            ? "Review transcript"
            : apiError
              ? "Try again"
              : "Transcribing..."}{" "}
          <Icon name={apiError ? "refresh" : "arrow"} size={17} />
        </Button>
      </div>
    </>
  );
}
