// Vault — shared types for the rebuilt vault system.

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

// Notes content can be either legacy block-array (NoteBlock[]) or a Tiptap
// ProseMirror doc object. Always read it via noteContentToText / noteFirstLine.
export type NoteContent = NoteBlock[] | { type: string; content?: unknown } | null;

export type NoteRow = {
  id: string;
  title: string;
  content: NoteContent;
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
  pulse_post: "#f59e0b",
  cohort_post: "#38bdf8",
  project: "#a78bfa",
};

/**
 * Pull a flat text representation from a note's `content` field.
 *
 * Notes started as an array of { type, text } blocks. After the Tiptap rewrite
 * they're stored as a ProseMirror doc object ({ type: "doc", content: [...] })
 * which has nested children. This helper handles both — never assume one shape.
 */
export function noteContentToText(content: unknown): string {
  if (!content) return "";
  // Legacy block-array format
  if (Array.isArray(content)) {
    return (content as any[])
      .map((b) => (b && typeof b === "object" && typeof b.text === "string" ? b.text : ""))
      .filter(Boolean)
      .join(" ");
  }
  // ProseMirror doc — walk recursively for "text" nodes
  const parts: string[] = [];
  function walk(node: any) {
    if (!node || typeof node !== "object") return;
    if (typeof node.text === "string") parts.push(node.text);
    if (Array.isArray(node.content)) for (const c of node.content) walk(c);
  }
  walk(content);
  return parts.join(" ");
}

/**
 * Return the first non-empty line of text from a note's content, for previews.
 */
export function noteFirstLine(content: unknown): string {
  const all = noteContentToText(content).trim();
  if (!all) return "";
  const nl = all.indexOf("\n");
  return nl === -1 ? all : all.slice(0, nl);
}

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
