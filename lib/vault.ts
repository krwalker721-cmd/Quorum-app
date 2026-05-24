// Vault â€” shared types for the rebuilt vault system.

export const NOTE_TAGS = [
  "decision",
  "hiring",
  "growth",
  "fundraising",
  "mindset",
  "ops",
  "product",
] as const;
export type NoteTag = (typeof NOTE_TAGS)[number];

export const BLOCK_TYPES = [
  "text",
  "h1",
  "h2",
  "bullet",
  "numbered",
  "divider",
  "quote",
  "code",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export type NoteBlock = {
  id?: string;
  type: BlockType;
  text?: string;
};

export type SavedItemType = "pulse_post" | "cohort_post" | "project";

export type SavedItemRow = {
  id: string;
  user_id: string;
  item_type: SavedItemType;
  item_id: string;
  personal_note: string | null;
  created_at: string;
};

export type NoteRow = {
  id: string;
  title: string;
  content: NoteBlock[];
  collection_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type NoteCollectionRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export const ITEM_TYPE_LABEL: Record<SavedItemType, string> = {
  pulse_post: "pulse_post",
  cohort_post: "cohort_post",
  project: "project",
};

export const ITEM_TYPE_COLOR: Record<SavedItemType, string> = {
  pulse_post: "#e8702a",
  cohort_post: "#38bdf8",
  project: "#a78bfa",
};

export function shortTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}
