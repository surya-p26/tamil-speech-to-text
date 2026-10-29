import type { ReactNode } from "react";

export type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: Record<string, unknown>,
      ) => void;
    };
  };
};

export type AppPreferences = {
  defaultDocumentFormat: "PDF" | "DOCX";
  compactLayout: boolean;
  confirmBeforeDelete: boolean;
};

export const PREFERENCES_STORAGE_KEY = "tamiltranscribe.preferences.v1";

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  defaultDocumentFormat: "PDF",
  compactLayout: false,
  confirmBeforeDelete: true,
};

export function readAppPreferences(): AppPreferences {
  try {
    const saved = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!saved) return DEFAULT_APP_PREFERENCES;
    const parsed = JSON.parse(saved) as Partial<AppPreferences>;
    return {
      defaultDocumentFormat: parsed.defaultDocumentFormat === "DOCX" ? "DOCX" : "PDF",
      compactLayout: parsed.compactLayout === true,
      confirmBeforeDelete: parsed.confirmBeforeDelete !== false,
    };
  } catch {
    return DEFAULT_APP_PREFERENCES;
  }
}

export type Page =
  | "dashboard"
  | "upload"
  | "preprocess"
  | "transcribing"
  | "editor"
  | "postprocess"
  | "generator"
  | "export"
  | "history"
  | "documents"
  | "evaluation"
  | "settings"
  | "states";

export type IconName =
  | "grid"
  | "plus"
  | "clock"
  | "file"
  | "chart"
  | "settings"
  | "search"
  | "bell"
  | "chevron"
  | "upload"
  | "audio"
  | "check"
  | "dots"
  | "download"
  | "play"
  | "pause"
  | "edit"
  | "filter"
  | "arrow"
  | "sparkles"
  | "refresh"
  | "alert"
  | "menu"
  | "close"
  | "folder"
  | "users"
  | "shield"
  | "logout"
  | "trash";
