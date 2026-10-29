import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui/Icons";
import { Button, Badge } from "./ui/UIComponents";
import { formatDuration, audioBufferToWav } from "../utils/formatters";

export function AudioRecorder({
  onRecordingReady,
}: {
  onRecordingReady: (file: File) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [converting, setConverting] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const startRecording = async () => {
    setRecordingError(null);
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecordingError(
        "Microphone recording needs a secure browser context. On this computer, open TamilTranscribe using http://localhost:8443, or use HTTPS for a network address.",
      );
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const preferredType = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferredType
        ? new MediaRecorder(stream, { mimeType: preferredType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setRecordingError(
          "The browser could not record audio. Check microphone access and try again.",
        );
      };
      recorder.onstop = async () => {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setRecording(false);
        setConverting(true);
        let completedFile: File | null = null;
        let audioContext: AudioContext | null = null;
        try {
          const type =
            recorder.mimeType ||
            chunksRef.current[0]?.type ||
            "audio/webm";
          const recordedBlob = new Blob(chunksRef.current, { type });
          if (recordedBlob.size === 0)
            throw new Error("No audio data was recorded.");
          audioContext = new AudioContext();
          const audioBuffer = await audioContext.decodeAudioData(
            await recordedBlob.arrayBuffer(),
          );
          const wavBlob = audioBufferToWav(audioBuffer);
          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          completedFile = new File(
            [wavBlob],
            `tamil-recording-${stamp}.wav`,
            { type: "audio/wav" },
          );
        } catch {
          setRecordingError(
            "The recording could not be converted to WAV. Try recording again or upload a WAV/OGG file.",
          );
        } finally {
          if (audioContext && audioContext.state !== "closed") {
            try {
              await audioContext.close();
            } catch {
              /* Audio context already closed. */
            }
          }
          streamRef.current?.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          setConverting(false);
        }
        if (completedFile) onRecordingReady(completedFile);
      };
      recorder.start(250);
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(
        () => setRecordingTime((seconds) => seconds + 1),
        1000,
      );
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const errorName = error instanceof DOMException ? error.name : "";
      if (errorName === "NotAllowedError" || errorName === "SecurityError") {
        setRecordingError(
          "Microphone access was blocked. Allow microphone permission and open this page through localhost or HTTPS.",
        );
      } else {
        setRecordingError(
          error instanceof Error
            ? error.message
            : "Could not start microphone recording.",
        );
      }
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  return (
    <div className="record-panel" aria-live="polite">
      <div className={`record-panel-icon ${recording ? "is-recording" : ""}`}>
        <Icon name="audio" size={20} />
      </div>
      <div className="record-panel-copy">
        <strong>
          {recording
            ? "Recording your speech…"
            : converting
              ? "Preparing your recording…"
              : "Record with your microphone"}
        </strong>
        <small>
          {recording
            ? "Speak clearly, then stop to use this recording."
            : converting
              ? "Converting the recording to WAV for transcription."
              : "Press record, speak in Tamil, and stop when finished."}
        </small>
      </div>
      {recording && (
        <span className="record-timer">{formatDuration(recordingTime)}</span>
      )}
      {recording ? (
        <Button variant="danger" onClick={stopRecording}>
          Stop recording
        </Button>
      ) : converting ? (
        <Badge tone="blue">Preparing</Badge>
      ) : (
        <Button variant="secondary" icon="audio" onClick={startRecording}>
          Record audio
        </Button>
      )}
      {recordingError && <p className="record-error">{recordingError}</p>}
    </div>
  );
}
