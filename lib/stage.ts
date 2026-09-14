export type Stage = "idea" | "pre-seed" | "seed" | "series_a";

export const STAGE_COLOR: Record<string, string> = {
  idea: "#38bdf8",
  "pre-seed": "#f59e0b",
  seed: "#22c55e",
  series_a: "#a78bfa",
};

// Pulse room_type  color + label. Used for post-card borders, type pills,
// trending widgets, and the post-creation type selector.
export const ROOM_TYPE_COLOR: Record<string, string> = {
  question: "#38bdf8",
  update: "#6e7681",
  decision: "#f59e0b",
  win: "#22c55e",
  blocker: "#f59e0b",
};

export const ROOM_TYPE_LABEL: Record<string, string> = {
  question: "ask the room something real",
  update: "share where you're at",
  decision: "thinking something through out loud",
  win: "something worked — share it",
  blocker: "stuck on something — the room can help",
};

export const TAG_COLOR: Record<string, string> = {
  decision: "#f59e0b",
  mindset: "#a78bfa",
  hiring: "#38bdf8",
  real_talk: "#f59e0b",
  growth: "#f59e0b",
  ops: "#6e7681",
  fundraising: "#f59e0b",
  "co-founder": "#22c55e",
};

export function initials(name: string | null | undefined) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}

// Several tables (posts among them, supabase/schema.sql) use `timestamp`
// without a time zone. The database clock is UTC, but those values come back
// with no "Z", and `new Date()` reads a zoneless string as local time: a post
// made a minute ago looked hours in the future ("-14353s ago"). Treat a
// zoneless string as UTC.
export function parseDbTime(ts: string | Date): Date {
  if (typeof ts !== "string") return ts;
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(ts);
  return new Date(zoned ? ts : `${ts.replace(" ", "T")}Z`);
}

export function timeAgo(ts: string | Date) {
  const d = parseDbTime(ts);
  // Clamped at zero, so a slightly fast clock never shows a negative age.
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
