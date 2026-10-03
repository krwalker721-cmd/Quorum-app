import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArenaPerson } from "@/lib/hackathons/page";

// A team's private room (Phase 6): what it holds, read through the signed-in
// member's own client so RLS decides (the team and admins only; migration 019).
// Shared by the server page and the client room. No server imports here.

export type RoomTeam = {
  id: string;
  name: string;
  slug: string;
  emblem: string | null;
  color: string | null;
  is_random_matched: boolean;
};

export type RoomMember = ArenaPerson & { role: "owner" | "member" };

export type RoomMessageRow = {
  id: string;
  user_id: string | null;
  body: string;
  is_system: boolean;
  created_at: string;
  deleted_at: string | null;
};

/** A doc's listing; the content loads when it's opened. */
export type RoomDocRow = {
  id: string;
  title: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RoomLinkRow = {
  id: string;
  url: string;
  label: string | null;
  created_by: string | null;
  created_at: string;
};

export type RoomVoteRow = {
  id: string;
  title: string;
  description: string | null;
  options: string[];
  status: "open" | "decided";
  winning_option: string | null;
  created_by: string | null;
  created_at: string;
};

export type RoomBallotRow = { id: string; vote_id: string; user_id: string; option_chosen: string };

/** Migration 028: one row per teammate. */
export type MemberActivity = {
  user_id: string;
  last_active_at: string | null;
  last_seen_at: string | null;
  time_zone: string | null;
  sleeping_until: string | null;
};

/** The team's submission: complete (completed_at) or a draft (migration 030). */
export type RoomSubmission = { is_complete: boolean; completed_at: string | null; updated_at: string } | null;

export type RoomData = {
  team: RoomTeam;
  members: RoomMember[];
  messages: RoomMessageRow[];
  docs: RoomDocRow[];
  links: RoomLinkRow[];
  votes: RoomVoteRow[];
  ballots: RoomBallotRow[];
  activity: MemberActivity[];
  submission: RoomSubmission;
};

export const MESSAGE_COLUMNS = "id, user_id, body, is_system, created_at, deleted_at";
export const DOC_COLUMNS = "id, title, created_by, updated_by, created_at, updated_at";
export const LINK_COLUMNS = "id, url, label, created_by, created_at";
export const VOTE_COLUMNS = "id, title, description, options, status, winning_option, created_by, created_at";
export const BALLOT_COLUMNS = "id, vote_id, user_id, option_chosen";
export const ACTIVITY_COLUMNS = "user_id, last_active_at, last_seen_at, time_zone, sleeping_until";
/** The thread shows the latest this many. */
export const MESSAGE_LIMIT = 500;

/** Everything in the room. Works from the server page and from the browser (a re-read). */
export async function loadRoom(db: SupabaseClient, team: RoomTeam): Promise<RoomData> {
  const [members, messages, docs, links, votes, ballots, activity, submission] = await Promise.all([
    db.from("hackathon_team_members").select("user_id, role, joined_at").eq("team_id", team.id),
    db
      .from("hackathon_team_messages")
      .select(MESSAGE_COLUMNS)
      .eq("team_id", team.id)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_LIMIT),
    db.from("hackathon_team_docs").select(DOC_COLUMNS).eq("team_id", team.id).order("updated_at", { ascending: false }),
    db.from("hackathon_team_links").select(LINK_COLUMNS).eq("team_id", team.id).order("created_at", { ascending: false }),
    db.from("hackathon_team_votes").select(VOTE_COLUMNS).eq("team_id", team.id).order("created_at", { ascending: false }),
    db.from("hackathon_team_ballots").select(BALLOT_COLUMNS).eq("team_id", team.id),
    // Migration 028. Until it's applied, the header just has no activity.
    db.from("hackathon_team_member_activity").select(ACTIVITY_COLUMNS).eq("team_id", team.id),
    db.from("hackathon_submissions").select("is_complete, completed_at, updated_at").eq("team_id", team.id).maybeSingle(),
  ]);

  const memberRows = (members.data ?? []) as { user_id: string; role: "owner" | "member"; joined_at: string }[];
  const ids = memberRows.map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await db.from("profiles").select("id, full_name, username, stage").in("id", ids)
    : { data: [] as ArenaPerson[] };
  const byId = new Map(((profiles ?? []) as ArenaPerson[]).map((p) => [p.id, p]));

  return {
    team,
    members: memberRows
      .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.joined_at.localeCompare(b.joined_at)))
      .map((m) => ({
        ...(byId.get(m.user_id) ?? { id: m.user_id, full_name: null, username: null, stage: null }),
        role: m.role,
      })),
    messages: ((messages.data ?? []) as RoomMessageRow[]).reverse(),
    docs: (docs.data ?? []) as RoomDocRow[],
    links: (links.data ?? []) as RoomLinkRow[],
    votes: (votes.data ?? []) as RoomVoteRow[],
    ballots: (ballots.data ?? []) as RoomBallotRow[],
    activity: activity.error ? [] : ((activity.data ?? []) as MemberActivity[]),
    submission: (submission.data as RoomSubmission) ?? null,
  };
}

export const TEAM_COLUMNS = "id, name, slug, emblem, color, is_random_matched";

/** Where a team's room lives. */
export const roomHref = (sprintNumber: number, slug: string) => `/hackathon/${sprintNumber}/team/${slug}`;
