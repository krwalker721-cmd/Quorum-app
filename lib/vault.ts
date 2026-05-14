export const VAULT_TAGS = [
  "fundraising",
  "hiring",
  "co-founder",
  "growth",
  "ops",
  "mindset",
] as const;

export type VaultTag = (typeof VAULT_TAGS)[number];

export type VaultPost = {
  id: string;
  author_id: string | null;
  title: string;
  content: string;
  credential: string | null;
  tag: string | null;
  read_time_minutes: number | null;
  created_at: string;
};

export type VaultAuthor = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
};

export type Tier = "free" | "tier_1" | "tier_2";

/**
 * Decide whether the user can read this post's content in full.
 * - tier_2: everything
 * - tier_1: the first two posts only (by created_at ascending order)
 * - free:   nothing (title + author only)
 */
export function isUnlocked(
  tier: Tier,
  postIndexFromOldest: number,
): boolean {
  if (tier === "tier_2") return true;
  if (tier === "tier_1") return postIndexFromOldest < 2;
  return false;
}

/** First N sentences of a content body (after stripping markdown headings). */
export function description(content: string, sentences = 2): string {
  const stripped = content
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = stripped.split(/(?<=[.!?])\s+/);
  return parts.slice(0, sentences).join(" ");
}
