import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedMessageRow, FeedPerson, FeedSubmission } from "@/components/hackathon/feed/SprintFeed";
import type { ArenaTeam } from "./page";
import type { SprintRow } from "./sprint";

// What the Sprint page's feed needs (was the lobby page; a feed since 034).
// The database decides who reads (private.can_read_lobby: every active
// member) and who posts (private.can_write_lobby); this only works out what
// to show: the composer, or why it's closed.

const MESSAGE_LIMIT = 300;

export type FeedData = {
  messages: FeedMessageRow[];
  submissions: FeedSubmission[];
  welcome: string | null;
  people: FeedPerson[];
  canPost: boolean;
  closedReason: string | null;
};

/** Phases with a feed: from registration on (the lobby's life), never a draft or an announcement. */
export function hasFeed(sprint: Pick<SprintRow, "is_published" | "phase">) {
  return sprint.is_published && !["draft", "upcoming"].includes(sprint.phase);
}

export async function loadFeed(
  db: SupabaseClient,
  sprint: SprintRow,
  viewer: { role: string; isAdmin: boolean; isActive: boolean },
  teams: ArenaTeam[],
): Promise<FeedData> {
  const [messages, welcome, people] = await Promise.all([
    db
      .from("hackathon_lobby_messages")
      .select("id, user_id, body, is_system, is_pinned, system_key, created_at, deleted_at")
      .eq("hackathon_id", sprint.id)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_LIMIT),
    db.rpc("hackathon_lobby_welcome", { p_hackathon_id: sprint.id }),
    db.rpc("hackathon_lobby_people", { p_hackathon_id: sprint.id }),
  ]);

  // Who may post, on the database's terms (private.can_write_lobby).
  const closesAt = sprint.lobby_closes_at ? Date.parse(sprint.lobby_closes_at) : null;
  const open = sprint.is_published && sprint.state !== "cancelled" && (closesAt === null || Date.now() < closesAt);
  const inIt = viewer.isAdmin || viewer.role === "judge" || viewer.role === "participant";
  const mayPost = viewer.isAdmin || viewer.role === "judge" || (viewer.role === "participant" && (sprint.phase !== "revealed" || viewer.isActive));
  const closedReason = !inIt
    ? null
    : !open
      ? sprint.state === "cancelled"
        ? "This Sprint was cancelled, so the feed is read-only."
        : "The feed has closed. Everything here stays readable."
      : !mayPost
        ? "Your membership has lapsed, so you can read the feed but not post. Renew to join in again."
        : null;

  const submissions: FeedSubmission[] = teams
    .filter((t) => t.pulse?.has_submitted && t.pulse.submitted_at)
    .map((t) => ({ teamId: t.id, name: t.name, emblem: t.emblem, color: t.color, at: t.pulse!.submitted_at! }));

  return {
    messages: (messages.data ?? []) as FeedMessageRow[],
    submissions,
    welcome: (welcome.error ? null : (welcome.data as string | null)) ?? null,
    people: (people.error ? [] : (people.data as FeedPerson[] | null)) ?? [],
    canPost: inIt,
    closedReason,
  };
}
