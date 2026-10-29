import { useEffect, useRef, useState } from "react";
import type { Page } from "../types";
import type { TranscriptionResponse } from "../api";
import { Icon } from "../components/ui/Icons";
import {
  Button,
  Card,
  Badge,
  PageHead,
  FlowSteps,
} from "../components/ui/UIComponents";
import { AudioPlayer } from "../components/AudioPlayer";
import { formatDuration } from "../utils/formatters";

export function EditorPage({
  setPage,
  selectedFile,
  audioDuration,
  transcriptionResult,
  text,
  setText,
  saveTranscript,
}: {
  setPage: (page: Page) => void;
  selectedFile: File | null;
  audioDuration: number | null;
  transcriptionResult: TranscriptionResponse | null;
  text: string;
  setText: (text: string) => void;
  saveTranscript: (text: string) => Promise<void>;
}) {
  const [playbackRate, setPlaybackRate] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const fileName =
    selectedFile?.name ?? transcriptionResult?.filename ?? "Tamil audio";
  const [showTamilKeyboard, setShowTamilKeyboard] = useState(false);
  const [tamilKeyboardTab, setTamilKeyboardTab] = useState<
    "uyir" | "mei" | "uyirmei" | "symbols"
  >("uyir");
  const [selectedTamilVowel, setSelectedTamilVowel] = useState("அ");
  const transcriptAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingTamilCursorRef = useRef<number | null>(null);

  const tamilVowels = [
    "அ", "ஆ", "இ", "ஈ", "உ", "ஊ", "எ", "ஏ", "ஐ", "ஒ", "ஓ", "ஔ",
  ];
  const tamilMeiLetters = [
    "க்", "ங்", "ச்", "ஞ்", "ட்", "ண்", "த்", "ந்", "ப்", "ம்",
    "ய்", "ர்", "ல்", "வ்", "ழ்", "ள்", "ற்", "ன்", "ஜ்", "ஷ்",
    "ஸ்", "ஹ்", "க்ஷ்",
  ];
  const tamilVowelMarks: Record<string, string> = {
    "ஆ": "ா", "இ": "ி", "ஈ": "ீ", "உ": "ு", "ஊ": "ூ", "எ": "ெ",
    "ஏ": "ே", "ஐ": "ை", "ஒ": "ொ", "ஓ": "ோ", "ஔ": "ௌ",
  };
  const tamilSymbols = [
    "ஃ", "௦", "௧", "௨", "௩", "௪", "௫", "௬", "௭", "௮", "௯",
    "(", ")", ",", ".", "?", "!", ":", ";", "—", "'", "\"",
  ];

  useEffect(() => {
    const cursor = pendingTamilCursorRef.current;
    if (cursor === null) return;
    const area = transcriptAreaRef.current;
    if (!area) return;
    const frame = window.requestAnimationFrame(() => {
      const currentArea = transcriptAreaRef.current;
      if (currentArea) {
        currentArea.focus();
        currentArea.setSelectionRange(cursor, cursor);
      }
      pendingTamilCursorRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [text]);

  const insertTamilText = (inserted: string) => {
    const area = transcriptAreaRef.current;
    const start = area?.selectionStart ?? text.length;
    const end = area?.selectionEnd ?? start;
    setText(text.slice(0, start) + inserted + text.slice(end));
    pendingTamilCursorRef.current = start + inserted.length;
  };

  const backspaceTamilText = () => {
    const area = transcriptAreaRef.current;
    let start = area?.selectionStart ?? text.length;
    let end = area?.selectionEnd ?? start;
    if (start === end && start > 0) {
      const previous = text.slice(start - 1, start);
      start -= 1;
      // Remove a Tamil vowel sign/pulli together with the base character.
      if (/[\u0BBE-\u0BCD\u0BD7]/u.test(previous) && start > 0) start -= 1;
    }
    if (start === end) return;
    setText(text.slice(0, start) + text.slice(end));
    pendingTamilCursorRef.current = start;
  };

  const handleApprove = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveTranscript(text);
      setPage("postprocess");
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Could not save the transcript.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FlowSteps current="editor" />
      <PageHead
        eyebrow="REVIEW & EDIT"
        title="Review your transcript"
        description="Listen, edit and verify the AI-generated Tamil text."
        action={
          <Badge tone={transcriptionResult ? "green" : "amber"}>
            {transcriptionResult ? "Transcription received" : "No transcript"}
          </Badge>
        }
      />
      <div className="editor-grid">
        <div>
          <Card className="sticky-player">
            <div className="player-title">
              <div className="audio-file-icon">
                <Icon name="audio" />
              </div>
              <span>
                <b>{fileName}</b>
                <small>{formatDuration(audioDuration)}</small>
              </span>
            </div>
            {selectedFile ? (
              <>
                <AudioPlayer file={selectedFile} playbackRate={playbackRate} />
                <div className="speed-row">
                  <span>Playback speed</span>
                  {[0.75, 1, 1.25, 1.5].map((rate) => (
                    <button
                      className={rate === playbackRate ? "active" : ""}
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                    >
                      {rate}×
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="history-audio-note">
                This transcript was reopened from history. The original audio
                file was not archived, so only the saved text is available here.
              </p>
            )}
          </Card>
          <Card className="confidence-legend">
            <h3>Transcription result</h3>
            <div>
              <span>
                <i className="high" />{" "}
                {transcriptionResult
                  ? `Sample rate ${transcriptionResult.sample_rate} Hz`
                  : "Waiting for API result"}
              </span>
              <span>
                <i className="medium" />{" "}
                {transcriptionResult
                  ? `${transcriptionResult.channels} channel`
                  : "—"}
              </span>
              <span>
                <i className="low" /> {transcriptionResult?.device ?? "—"}
              </span>
            </div>
          </Card>
        </div>
        <Card className="text-editor">
          <div className="editor-toolbar">
            <div>
              <button>
                <b>B</b>
              </button>
              <button>
                <i>I</i>
              </button>
              <button>
                <u>U</u>
              </button>
              <span />
              <button>¶</button>
            </div>
            <div>
              <button>
                <Icon name="search" size={17} /> Find & replace
              </button>
              <button>
                <Icon name="refresh" size={17} /> Undo
              </button>
            </div>
          </div>
          <div className="segment-label">
            <span>00:00 — {formatDuration(audioDuration)}</span>
            <Badge tone={transcriptionResult ? "green" : "amber"}>
              {transcriptionResult ? "API generated" : "Waiting"}
            </Badge>
          </div>
          <textarea
            ref={transcriptAreaRef}
            lang="ta"
            spellCheck={false}
            placeholder="Tamil transcription will appear here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="tamil-keyboard-wrap">
            <div className="tamil-keyboard-intro">
              <div>
                <b>Tamil Virtual Keyboard</b>
                <small>Click a letter to insert it at the cursor position.</small>
              </div>
              <button
                type="button"
                className="tamil-keyboard-toggle"
                onClick={() => setShowTamilKeyboard((open) => !open)}
                aria-expanded={showTamilKeyboard}
              >
                {showTamilKeyboard ? "Hide Keyboard" : "Show Keyboard"}
              </button>
            </div>
            {showTamilKeyboard && (
              <div
                className="tamil-keyboard-panel"
                role="region"
                aria-label="Tamil virtual keyboard"
              >
                <div
                  className="tamil-keyboard-tabs"
                  role="tablist"
                  aria-label="Tamil character groups"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tamilKeyboardTab === "uyir"}
                    className={tamilKeyboardTab === "uyir" ? "active" : ""}
                    onClick={() => setTamilKeyboardTab("uyir")}
                  >
                    உயிர்
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tamilKeyboardTab === "mei"}
                    className={tamilKeyboardTab === "mei" ? "active" : ""}
                    onClick={() => setTamilKeyboardTab("mei")}
                  >
                    மெய்
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tamilKeyboardTab === "uyirmei"}
                    className={tamilKeyboardTab === "uyirmei" ? "active" : ""}
                    onClick={() => setTamilKeyboardTab("uyirmei")}
                  >
                    உயிர்மெய்
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tamilKeyboardTab === "symbols"}
                    className={tamilKeyboardTab === "symbols" ? "active" : ""}
                    onClick={() => setTamilKeyboardTab("symbols")}
                  >
                    குறிகள்
                  </button>
                </div>

                {tamilKeyboardTab === "uyir" && (
                  <div className="tamil-key-grid" aria-label="Tamil vowels">
                    {tamilVowels.map((letter) => (
                      <button
                        type="button"
                        className="tamil-key"
                        key={letter}
                        onClick={() => insertTamilText(letter)}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                )}

                {tamilKeyboardTab === "mei" && (
                  <div className="tamil-key-grid" aria-label="Tamil consonants">
                    {tamilMeiLetters.map((letter) => (
                      <button
                        type="button"
                        className="tamil-key"
                        key={letter}
                        onClick={() => insertTamilText(letter)}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                )}

                {tamilKeyboardTab === "uyirmei" && (
                  <>
                    <div
                      className="tamil-vowel-select"
                      aria-label="Choose vowel sound"
                    >
                      {tamilVowels.map((vowel) => (
                        <button
                          type="button"
                          key={vowel}
                          className={
                            selectedTamilVowel === vowel ? "active" : ""
                          }
                          onClick={() => setSelectedTamilVowel(vowel)}
                        >
                          {vowel}
                        </button>
                      ))}
                    </div>
                    <div
                      className="tamil-key-grid"
                      aria-label="Tamil consonant-vowel combinations"
                    >
                      {tamilMeiLetters.map((mei) => {
                        const base = mei.slice(0, -1);
                        const letter =
                          selectedTamilVowel === "அ"
                            ? base
                            : base + tamilVowelMarks[selectedTamilVowel];
                        return (
                          <button
                            type="button"
                            className="tamil-key"
                            key={`${mei}-${selectedTamilVowel}`}
                            onClick={() => insertTamilText(letter)}
                          >
                            {letter}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {tamilKeyboardTab === "symbols" && (
                  <div
                    className="tamil-key-grid"
                    aria-label="Punctuation and Tamil numerals"
                  >
                    {tamilSymbols.map((symbol, index) => (
                      <button
                        type="button"
                        className="tamil-key"
                        key={`${symbol}-${index}`}
                        onClick={() => insertTamilText(symbol)}
                      >
                        {symbol === " " ? "இடைவெளி" : symbol}
                      </button>
                    ))}
                  </div>
                )}

                <div className="tamil-keyboard-actions">
                  <button type="button" onClick={() => insertTamilText(" ")}>
                    இடைவெளி · Space
                  </button>
                  <button type="button" onClick={() => insertTamilText("\n")}>
                    புதிய வரி · Enter
                  </button>
                  <button type="button" onClick={backspaceTamilText}>
                    ⌫ Backspace
                  </button>
                  <button type="button" onClick={() => insertTamilText("ஃ")}>
                    ஆய்த எழுத்து · ஃ
                  </button>
                </div>
                <small className="tamil-keyboard-note">
                  குறிப்பு: உரையில் ஒரு பகுதியைத் தேர்ந்தெடுத்திருந்தால்,
                  தேர்ந்தெடுத்த எழுத்துகள் புதிய எழுத்தால் மாற்றப்படும்.
                </small>
              </div>
            )}
          </div>
          <div className="editor-footer">
            <span>
              {text.length} characters · {wordCount} words
            </span>
            <span>Tamil Unicode</span>
          </div>
        </Card>
      </div>
      {saveError && (
        <div className="inline-message warning">
          <Icon name="alert" /> {saveError}
        </div>
      )}
      <div className="page-actions">
        <Button variant="ghost" onClick={() => setPage("transcribing")}>
          Back
        </Button>
        <Button onClick={handleApprove} disabled={saving}>
          {saving ? "Saving transcript..." : "Approve & refine"}{" "}
          <Icon name="arrow" size={17} />
        </Button>
      </div>
    </>
  );
}
