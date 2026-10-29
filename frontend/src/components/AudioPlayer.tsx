import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Icon } from "./ui/Icons";
import { formatDuration } from "../utils/formatters";

export function AudioPlayer({
  file,
  onDurationChange,
  playbackRate = 1,
}: {
  file?: File | null;
  onDurationChange?: (seconds: number | null) => void;
  playbackRate?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;

    if (!file || !audio) {
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setAudioError(false);
      onDurationChange?.(null);
      return;
    }

    const url = URL.createObjectURL(file);
    audio.src = url;
    audio.load();
    setPlaying(false);
    setCurrentTime(0);
    setAudioError(false);

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
    };
  }, [file, onDurationChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(nextDuration);
      onDurationChange?.(nextDuration || null);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setPlaying(false);
    const handleError = () => setAudioError(true);

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [file, onDurationChange]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !file || audioError) return;

    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setAudioError(true);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="audio-player-wrap">
      <div className="audio-player">
        <audio ref={audioRef} preload="metadata" />
        <button
          className="play-btn"
          onClick={togglePlayback}
          disabled={!file || audioError}
          title={
            audioError
              ? "This browser could not play the selected audio"
              : undefined
          }
        >
          <Icon name={playing ? "pause" : "play"} size={18} />
        </button>
        <span>{formatDuration(currentTime)}</span>
        <div className="wave" aria-hidden="true">
          {Array.from({ length: 48 }).map((_, i) => (
            <i
              key={i}
              className={
                duration > 0 && i / 48 <= currentTime / duration ? "played" : ""
              }
              style={{ height: `${10 + ((i * 17) % 27)}px` }}
            />
          ))}
        </div>
        <span>{formatDuration(duration)}</span>
        <button
          className="icon-btn"
          type="button"
          aria-label="Audio player options"
        >
          <Icon name="dots" />
        </button>
      </div>
      <input
        className="audio-seek"
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={duration > 0 ? Math.min(currentTime, duration) : 0}
        disabled={!file || !duration || audioError}
        aria-label="Audio playback position"
        style={
          {
            "--audio-progress": `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
          } as CSSProperties
        }
        onChange={(event) => {
          const nextTime = Number(event.target.value);
          const audio = audioRef.current;
          if (audio && Number.isFinite(nextTime)) {
            audio.currentTime = nextTime;
            setCurrentTime(nextTime);
          }
        }}
      />
    </div>
  );
}
