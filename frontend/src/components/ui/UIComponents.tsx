import type { ReactNode } from "react";
import type { IconName, Page } from "../../types";
import { Icon } from "./Icons";

export function Button({
  children,
  variant = "primary",
  icon,
  onClick,
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "green" | "amber" | "gray" | "red";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export const flow: { page: Page; label: string }[] = [
  { page: "upload", label: "Upload" },
  { page: "preprocess", label: "Pre-process" },
  { page: "transcribing", label: "Transcribe" },
  { page: "editor", label: "Review" },
  { page: "postprocess", label: "Refine" },
  { page: "generator", label: "Generate" },
  { page: "export", label: "Export" },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo-wrap">
      <div className="logo-mark">
        <span>த</span>
        <i />
      </div>
      {!compact && (
        <div>
          <strong>TamilTranscribe</strong>
          <small>அரசு AI எழுத்தாக்கம்</small>
        </div>
      )}
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function FlowSteps({ current }: { current: Page }) {
  const active = flow.findIndex((f) => f.page === current);
  return (
    <div className="flow-steps">
      {flow.map((step, i) => (
        <div
          className={`${i < active ? "done" : ""} ${i === active ? "current" : ""}`}
          key={step.page}
        >
          <span>{i < active ? <Icon name="check" size={14} /> : i + 1}</span>
          <small>{step.label}</small>
        </div>
      ))}
    </div>
  );
}
