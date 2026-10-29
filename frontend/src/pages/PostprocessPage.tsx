import { useState } from "react";
import type { Page } from "../types";
import { restoreTamilPunctuation } from "../api";
import { Icon } from "../components/ui/Icons";
import {
  Button,
  Card,
  Badge,
  PageHead,
  FlowSteps,
} from "../components/ui/UIComponents";

export function PostprocessPage({
  setPage,
  text,
  setText,
  saveTranscript,
}: {
  setPage: (page: Page) => void;
  text: string;
  setText: (text: string) => void;
  saveTranscript: (text: string) => Promise<void>;
}) {
  const [originalText] = useState(text);
  const [appliedText, setAppliedText] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [punctuationError, setPunctuationError] = useState<string | null>(null);
  const [punctuationModelName, setPunctuationModelName] = useState<string | null>(
    null,
  );
  const [restorePunctuation, setRestorePunctuation] = useState(true);
  const [unicodeNormalization, setUnicodeNormalization] = useState(true);
  const [whitespaceCleanup, setWhitespaceCleanup] = useState(true);

  const invalidateAppliedPreview = () => {
    setApplied(false);
    setAppliedText(null);
    setPunctuationError(null);
    setPunctuationModelName(null);
  };

  let basicPreviewText = originalText;
  if (unicodeNormalization) basicPreviewText = basicPreviewText.normalize("NFC");
  if (whitespaceCleanup) {
    basicPreviewText = basicPreviewText
      .replace(/[\t\f\v ]+/g, " ")
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .replace(/\s+([,.!?;:…])/g, "$1")
      .trim();
  }
  // This is only a simple preview fallback. The Apply button uses Cadence-Fast
  // when AI punctuation restoration is enabled.
  if (
    restorePunctuation &&
    basicPreviewText &&
    !/[.!?…।]$/.test(basicPreviewText)
  ) {
    basicPreviewText += ".";
  }
  const previewText = appliedText ?? basicPreviewText;
  const unicodeChanged = originalText !== originalText.normalize("NFC");
  const countPunctuation = (value: string) =>
    (value.match(/[,.!?;:…।]/g) ?? []).length;
  const punctuationAdded =
    countPunctuation(previewText) > countPunctuation(originalText);

  const applyRefinements = async () => {
    setApplying(true);
    setPunctuationError(null);
    setSaveError(null);
    try {
      let candidate = originalText;
      if (unicodeNormalization) candidate = candidate.normalize("NFC");
      if (whitespaceCleanup) {
        candidate = candidate
          .replace(/[\t\f\v ]+/g, " ")
          .replace(/[ \t]*\n[ \t]*/g, "\n")
          .replace(/\s+([,.!?;:…])/g, "$1")
          .trim();
      }
      if (restorePunctuation && candidate.trim()) {
        const result = await restoreTamilPunctuation(candidate);
        candidate = result.transcription;
        setPunctuationModelName(result.model);
      } else {
        setPunctuationModelName(null);
      }
      setAppliedText(candidate);
      setText(candidate);
      setApplied(true);
    } catch (error) {
      setPunctuationError(
        error instanceof Error
          ? error.message
          : "Could not restore Tamil punctuation.",
      );
      setApplied(false);
      setAppliedText(null);
    } finally {
      setApplying(false);
    }
  };

  const continueToGenerator = async () => {
    if (restorePunctuation && !appliedText) {
      setSaveError(
        "Apply selected refinements first to run AI punctuation restoration. You can turn off AI punctuation if you only need basic cleanup.",
      );
      return;
    }
    const finalText = appliedText ?? basicPreviewText;
    if (!finalText.trim()) {
      alert("No transcript is available to generate a document.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      setText(finalText);
      await saveTranscript(finalText);
      setPage("generator");
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Could not save the refined transcript.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FlowSteps current="postprocess" />
      <PageHead
        eyebrow="POST-PROCESSING"
        title="Polish the transcript"
        description="Normalize Tamil Unicode and spacing, then optionally use AI to restore commas, sentence boundaries and question marks."
      />
      <div className="post-grid">
        <div className="refine-options">
          <Card className="refine-card">
            <div className="refine-icon">
              <Icon name="shield" />
            </div>
            <span>
              <b>Unicode normalization</b>
              <small>Standardize Tamil characters to Unicode NFC format</small>
            </span>
            <label className="switch">
              <input
                type="checkbox"
                checked={unicodeNormalization}
                onChange={(e) => {
                  setUnicodeNormalization(e.target.checked);
                  invalidateAppliedPreview();
                }}
              />
              <i />
            </label>
          </Card>
          <Card className="refine-card">
            <div className="refine-icon">
              <Icon name="edit" />
            </div>
            <span>
              <b>Whitespace and punctuation spacing</b>
              <small>
                Remove repeated spaces and tidy spaces around punctuation
              </small>
            </span>
            <label className="switch">
              <input
                type="checkbox"
                checked={whitespaceCleanup}
                onChange={(e) => {
                  setWhitespaceCleanup(e.target.checked);
                  invalidateAppliedPreview();
                }}
              />
              <i />
            </label>
          </Card>
          <Card className="refine-card">
            <div className="refine-icon">
              <Icon name="sparkles" />
            </div>
            <span>
              <b>AI punctuation restoration</b>
              <small>
                Use AI4Bharat Cadence-Fast for commas, full stops, question
                marks and clause boundaries. It restores punctuation; it does
                not spell-correct words.
              </small>
            </span>
            <label className="switch">
              <input
                type="checkbox"
                checked={restorePunctuation}
                onChange={(e) => {
                  setRestorePunctuation(e.target.checked);
                  invalidateAppliedPreview();
                }}
              />
              <i />
            </label>
          </Card>
          {punctuationError && (
            <div className="inline-message warning">
              <Icon name="alert" /> {punctuationError}
            </div>
          )}
          <Button
            className="full-btn"
            icon="sparkles"
            onClick={() => void applyRefinements()}
            disabled={applying || !originalText.trim()}
          >
            {applying
              ? "Restoring punctuation..."
              : applied
                ? "Refinements applied"
                : "Apply selected refinements"}
          </Button>
        </div>
        <Card className="comparison">
          <div className="card-head">
            <div>
              <h2>Preview changes</h2>
              <p>
                {applied
                  ? "AI result is shown below; review it before generating a document."
                  : "Apply refinements to run the optional AI punctuation model."}
              </p>
            </div>
            <Badge tone={applied ? "green" : "amber"}>
              {applied ? "Applied" : "Preview"}
            </Badge>
          </div>
          <div className="compare-block">
            <span>ORIGINAL</span>
            <p lang="ta">{originalText || "No transcript available."}</p>
          </div>
          <div className="compare-arrow">
            <Icon name="arrow" />
          </div>
          <div className="compare-block improved">
            <span>REFINED</span>
            <p lang="ta">{previewText || "No transcript available."}</p>
            <small>
              {unicodeNormalization
                ? "Unicode normalized"
                : "Unicode normalization off"}{" "}
              ·{" "}
              {whitespaceCleanup
                ? "Whitespace cleaned"
                : "Whitespace unchanged"}{" "}
              ·{" "}
              {restorePunctuation
                ? punctuationModelName || "AI punctuation selected"
                : "AI punctuation off"}
            </small>
          </div>
          <div className="change-summary">
            <div>
              <strong>{unicodeChanged ? 1 : 0}</strong>
              <span>Unicode changes</span>
            </div>
            <div>
              <strong>
                {whitespaceCleanup &&
                originalText !==
                  originalText.replace(/[\t\f\v ]+/g, " ").trim()
                  ? 1
                  : 0}
              </strong>
              <span>Whitespace cleanup</span>
            </div>
            <div>
              <strong>
                {punctuationAdded && restorePunctuation ? 1 : 0}
              </strong>
              <span>Punctuation added</span>
            </div>
          </div>
        </Card>
      </div>
      {saveError && (
        <div className="inline-message warning">
          <Icon name="alert" /> {saveError}
        </div>
      )}
      <div className="page-actions">
        <Button variant="ghost" onClick={() => setPage("editor")}>
          Back to editor
        </Button>
        <Button
          onClick={() => void continueToGenerator()}
          disabled={saving || applying}
        >
          {saving ? "Saving transcript..." : "Generate document"}{" "}
          <Icon name="arrow" size={17} />
        </Button>
      </div>
    </>
  );
}
