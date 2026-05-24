export type Stage = "idea" | "pre-seed" | "seed" | "series_a";

export const STAGE_COLOR: Record<string, string> = {
  idea: "#38bdf8",
  "pre-seed": "#dc6414",
  seed: "#22c55e",
  series_a: "#a78bfa",
};

// Pulse room_type â†’ color + label. Used for post-card borders, type pills,
// trending widgets, and the post-creation type selector.
export const ROOM_TYPE_COLOR: Record<string, string> = {
  question: "#38bdf8",
  update: "#707070",
  decision: "#dc6414",
  win: "#22c55e",
  blocker: "#dc6414",
};

export const ROOM_TYPE_LABEL: Record<string, string> = {
  question: "ask the room something real",
  update: "share where you're at",
  decision: "thinking something through out loud",
  win: "something worked â€” share it",
  blocker: "stuck on something â€” the room can help",
};

export const TAG_COLOR: Record<string, string> = {
  decision: "#dc6414",
  mindset: "#a78bfa",
  hiring: "#38bdf8",
  real_talk: "#dc6414",
  growth: "#dc6414",
  ops: "#707070",
  fundraising: "#dc6414",
  "co-founder": "#22c55e",
};

export function initials(name: string | null | undefined) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}

export function timeAgo(ts: string | Date) {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
