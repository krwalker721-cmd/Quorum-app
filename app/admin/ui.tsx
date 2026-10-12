"use client";

// Small shared pieces for the admin console, in its existing look: mono,
// lower-case labels, hairline cards, one amber accent.

import { adminFetch } from "./lib/api";
import { askConfirm } from "./dialog";
import { formatNy } from "@/lib/time/newYork";

const AMBER: React.CSSProperties = {
  background: "rgba(245, 158, 11, 0.18)",
  color: "#f59e0b",
  border: "1px solid rgba(245, 158, 11, 0.55)",
  borderRadius: 5,
  boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)",
  fontWeight: 700,
  letterSpacing: "0.02em",
};
const GHOST: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 5, color: "var(--text-secondary)" };
const DANGER: React.CSSProperties = { border: "1px solid rgba(248, 81, 73, 0.5)", borderRadius: 5, color: "#f87171" };

export function Btn({
  variant = "ghost",
  className = "",
  style,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      type="button"
      {...rest}
      className={`font-mono lowercase text-[0.7rem] px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-125 transition ${className}`}
      style={{ ...(variant === "primary" ? AMBER : variant === "danger" ? DANGER : GHOST), ...style }}
    />
  );
}

export function Kicker({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`font-mono lowercase text-[0.7rem] text-text-faint mb-2 ${className}`}>{children}</p>;
}

export function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`border p-4 ${className}`} style={{ borderColor: "var(--border)", background: "var(--card)", ...style }}>
      {children}
    </div>
  );
}

export function ErrorLine({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="font-mono text-xs mt-2 break-words" style={{ color: "#f87171" }}>
      {children}
    </p>
  );
}

const STATE_COLOR: Record<string, string> = {
  draft: "#6e7681",
  upcoming: "#58a6ff",
  registration: "#38bdf8",
  teams_locked: "#a78bfa",
  live: "#22c55e",
  judging: "#f59e0b",
  revealed: "#e6edf3",
  paused: "#f59e0b",
  cancelled: "#f85149",
};

export function StateChip({ state }: { state: string | null }) {
  const c = STATE_COLOR[state ?? ""] ?? "#6e7681";
  return (
    <span
      className="font-mono text-[0.6rem] lowercase px-1.5 py-0.5 whitespace-nowrap"
      style={{ color: c, border: `1px solid ${c}55`, background: `${c}14` }}
    >
      {(state ?? "unknown").replace("_", " ")}
    </span>
  );
}

export type PostResult = { ok: boolean; status: number; error?: string; hint?: string | null; data?: unknown };

/** POST/PATCH JSON to an admin route, with the admin code attached. */
export async function send(path: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<PostResult> {
  const res = await adminFetch(path, { method, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, error: json.error, hint: json.hint ?? null, data: json.data ?? json };
}

/**
 * Sends a team action; if the database says the team is full, asks whether
 * to go over the limit on purpose and, if so, sends it again with the override.
 */
export async function sendWithOverride(path: string, body: Record<string, unknown>): Promise<PostResult> {
  const first = await send(path, body);
  if (first.ok || first.hint !== "team_full") return first;
  if (!(await askConfirm(`${first.error}\n\nGo over the size limit on purpose? This is recorded in the log.`, { ok: "go over the limit" }))) {
    return { ok: false, status: 0 };
  }
  return send(path, { ...body, raise_limit: true });
}

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

function show(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    if (v === "") return '""';
    // Times read in New York, like everywhere else in the admin.
    if (ISO_TIME.test(v)) return formatNy(v);
    return v;
  }
  return JSON.stringify(v);
}
function clip(s: string, n = 160) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** A log entry's field-by-field old → new. */
export function Changes({ changes }: { changes: Record<string, { old: unknown; new: unknown }> }) {
  return (
    <div className="mt-2 space-y-1">
      {Object.entries(changes).map(([field, c]) => (
        <p key={field} className="font-mono text-[0.7rem] break-words">
          <span className="text-text-muted">{field}:</span>{" "}
          <span className="text-text-faint" title={show(c.old)}>
            {clip(show(c.old))}
          </span>{" "}
          <span className="text-text-faint">→</span>{" "}
          <span className="text-text-secondary" title={show(c.new)}>
            {clip(show(c.new))}
          </span>
        </p>
      ))}
    </div>
  );
}
