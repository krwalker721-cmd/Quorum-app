export type Stage = "idea" | "pre-seed" | "seed" | "series_a";

export const STAGE_COLOR: Record<string, string> = {
  idea: "#38bdf8",
  "pre-seed": "#f59e0b",
  seed: "#22c55e",
  series_a: "#a78bfa",
};

export const TAG_COLOR: Record<string, string> = {
  decision: "#f59e0b",
  mindset: "#22c55e",
  hiring: "#38bdf8",
  real_talk: "#f59e0b",
  growth: "#22c55e",
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
