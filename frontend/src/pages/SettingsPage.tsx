import { useEffect, useState } from "react";
import type { AppPreferences } from "../types";
import { DEFAULT_APP_PREFERENCES } from "../types";
import { Icon } from "../components/ui/Icons";
import { Button, Card, Badge, PageHead } from "../components/ui/UIComponents";

export function SettingsPage({
  preferences,
  onSave,
}: {
  preferences: AppPreferences;
  onSave: (next: AppPreferences) => void;
}) {
  const [draft, setDraft] = useState<AppPreferences>(preferences);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  const change = <K extends keyof AppPreferences>(
    key: K,
    value: AppPreferences[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSavedMessage("");
  };

  const save = () => {
    onSave(draft);
    setSavedMessage("Preferences saved in this browser.");
  };

  const reset = () => {
    setDraft(DEFAULT_APP_PREFERENCES);
    setSavedMessage("Defaults selected. Press Save changes to apply them.");
  };

  return (
    <>
      <PageHead
        title="Settings"
        description="Configure practical defaults for your local TamilTranscribe workspace."
      />
      <div className="settings-functional-layout">
        <Card className="settings-content">
          <div className="settings-head">
            <h2>Transcription defaults</h2>
            <p>
              This build is configured for Tamil speech and the local
              IndicWhisper model.
            </p>
          </div>
          <div className="setting-row">
            <span>
              <b>Audio language</b>
              <small>
                The installed transcription model is configured for Tamil.
              </small>
            </span>
            <span className="setting-readonly">தமிழ் (Tamil)</span>
          </div>
          <div className="setting-row">
            <span>
              <b>Speech recognition model</b>
              <small>Model currently loaded by the backend.</small>
            </span>
            <span className="setting-readonly">IndicWhisper Tamil</span>
          </div>
          <div className="setting-row">
            <span>
              <b>Audio preprocessing</b>
              <small>
                Audio is standardized before recognition; this is required by
                the current pipeline.
              </small>
            </span>
            <Badge tone="green">
              <Icon name="check" size={12} /> Enabled
            </Badge>
          </div>
        </Card>
        <Card className="settings-content">
          <div className="settings-head">
            <h2>Document defaults</h2>
            <p>
              Your preference is applied to the download order when a document
              is generated.
            </p>
          </div>
          <div className="setting-row">
            <span>
              <b>Preferred download format</b>
              <small>
                Choose which generated file appears first and is highlighted.
              </small>
            </span>
            <select
              value={draft.defaultDocumentFormat}
              onChange={(event) =>
                change(
                  "defaultDocumentFormat",
                  event.target.value === "DOCX" ? "DOCX" : "PDF",
                )
              }
            >
              <option value="PDF">PDF document</option>
              <option value="DOCX">Word document (DOCX)</option>
            </select>
          </div>
        </Card>
        <Card className="settings-content">
          <div className="settings-head">
            <h2>History and interface</h2>
            <p>These options change how this workspace behaves.</p>
          </div>
          <div className="setting-row">
            <span>
              <b>Compact layout</b>
              <small>Reduce spacing in cards and saved-record lists.</small>
            </span>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.compactLayout}
                onChange={(event) =>
                  change("compactLayout", event.target.checked)
                }
              />
              <i />
            </label>
          </div>
          <div className="setting-row">
            <span>
              <b>Confirm before deleting a transcription</b>
              <small>
                Show a confirmation prompt before permanently deleting a
                history record.
              </small>
            </span>
            <label className="switch">
              <input
                type="checkbox"
                checked={draft.confirmBeforeDelete}
                onChange={(event) =>
                  change("confirmBeforeDelete", event.target.checked)
                }
              />
              <i />
            </label>
          </div>
          <div className="settings-save settings-save-functional">
            <div className="settings-save-message" role="status">
              {savedMessage || "Changes stay in draft until you save."}
            </div>
            <Button variant="ghost" onClick={reset}>
              Reset defaults
            </Button>
            <Button onClick={save}>Save changes</Button>
          </div>
        </Card>
        <div className="info-strip">
          <Icon name="shield" />
          <span>
            <b>Privacy and storage</b>
            <small>
              Settings are stored in this browser. Transcription records are
              stored by the backend in SQLite. Deleting a history row does not
              delete separately generated documents.
            </small>
          </span>
        </div>
      </div>
    </>
  );
}
