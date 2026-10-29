import { useState, type ReactNode } from "react";
import type { AuthUser } from "../api";
import type { Page, IconName } from "../types";
import { Icon } from "./ui/Icons";
import { Logo } from "./ui/UIComponents";

export const nav: {
  section?: string;
  page: Page;
  label: string;
  icon: IconName;
}[] = [
  { section: "WORKSPACE", page: "dashboard", label: "Dashboard", icon: "grid" },
  { page: "upload", label: "New transcription", icon: "plus" },
  { page: "history", label: "Transcription history", icon: "clock" },
  { page: "documents", label: "Documents", icon: "folder" },
  {
    section: "INSIGHTS",
    page: "evaluation",
    label: "Evaluation",
    icon: "chart",
  },
  { page: "states", label: "System states", icon: "alert" },
  {
    section: "ADMINISTRATION",
    page: "settings",
    label: "Settings",
    icon: "settings",
  },
];

export function Shell({
  page,
  setPage,
  onLogout,
  user,
  children,
}: {
  page: Page;
  setPage: (page: Page) => void;
  onLogout: () => void;
  user: AuthUser;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const initials =
    user.full_name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "TT";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="side-head">
          <Logo />
          <button
            className="icon-btn mobile-only"
            onClick={() => setMenu(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <nav>
          {nav.map((item) => (
            <div key={item.page}>
              {item.section && (
                <span className="nav-section">{item.section}</span>
              )}
              <button
                className={page === item.page ? "active" : ""}
                onClick={() => {
                  setPage(item.page);
                  setMenu(false);
                }}
              >
                <Icon name={item.icon} size={19} />
                <span>{item.label}</span>
              </button>
            </div>
          ))}
        </nav>
        <div className="side-profile">
          <div className="avatar">{initials}</div>
          <div>
            <strong>{user.full_name}</strong>
            <small>{user.email}</small>
          </div>
          <button className="icon-btn" onClick={onLogout} title="Sign out">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <div className="main-area">
        <header className="topbar">
          <button
            className="icon-btn mobile-only"
            onClick={() => setMenu(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="top-search">
            <Icon name="search" size={18} />
            <input placeholder="Search transcriptions, documents..." />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <button className="icon-btn notification" aria-label="Notifications">
              <Icon name="bell" size={19} />
              <i />
            </button>
            <span className="top-separator" />
            <div className="dept">
              <span>{user.department}</span>
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
