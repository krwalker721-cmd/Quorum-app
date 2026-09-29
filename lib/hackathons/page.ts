import type { SupabaseClient } from "@supabase/supabase-js";
import { SPRINT_COLUMNS, type SprintRow } from "@/lib/hackathons/sprint";

// Everything the Sprint page reads, through the signed-in member's own client,
// so RLS decides what comes back: a spectator gets the teams but never a team
// room, and nobody gets a submission before the reveal. Nothing here uses the
// service role.

/** How the viewer relates to this Sprint. */
export type ViewerRole =
  | "participant" // registered, not withdrawn
  | "judge" // accepted judge
  | "invited_judge" // invited, hasn't accepted yet
  | "spectator" // active member, not in it
  | "outsider"; // lapsed member, not in it

export type Viewer = {
  role: ViewerRole;
  isAdmin: boolean;
  isActive: boolean;
  /** Set for participants: random pool or own team, and the team if any. */
  mode: "random" | "team" | null;
  teamId: string | null;
};

export type ArenaPerson = { id: string; full_name: string | null; username: string | null; stage: string | null };

export type ArenaTeam = {
  id: string;
  name: string;
  slug: string;
  emblem: string | null;
  color: string | null;
  is_random_matched: boolean;
  members: (ArenaPerson & { role: "owner" | "member" })[];
  activity: { message_count: number; doc_count: number; link_count: number; last_active_at: string | null; has_submitted: boolean } | null;
};

export type Registrant = ArenaPerson & { registered_at: string };

export type Award = {
  id: string;
  award_type: "judges_pick" | "most_shipped" | "best_collaboration" | "most_likely_to_become_real" | "custom";
  custom_label: string | null;
  project_name: string | null;
  tagline: string | null;
  team_name: string | null;
};

export type SprintLink = Pick<SprintRow, "number" | "title" | "state" | "registration_opens_at" | "starts_at">;

export type SprintPageData = {
  sprint: SprintRow;
  viewer: Viewer;
  teams: ArenaTeam[];
  registrants: Registrant[] | null; // null: not shown in this state
  awards: Award[];
  /** For a spectator's "join the next one": the next announced Sprint, if any. */
  nextSprint: SprintLink | null;
};

export async function loadSprint(db: SupabaseClient, number: number): Promise<SprintRow | null> {
  const { data } = await db.from("hackathon_overview").select(SPRINT_COLUMNS).eq("number", number).maybeSingle();
  return (data as SprintRow | null) ?? null;
}

async function loadViewer(
  db: SupabaseClient,
  sprintId: string,
  userId: string,
  isAdmin: boolean,
  isActive: boolean,
): Promise<Viewer> {
  const [reg, judge, member] = await Promise.all([
    db
      .from("hackathon_registrations")
      .select("mode, team_id, withdrawn_at")
      .eq("hackathon_id", sprintId)
      .eq("user_id", userId)
      .maybeSingle(),
    db.from("hackathon_judges").select("accepted_at").eq("hackathon_id", sprintId).eq("user_id", userId).maybeSingle(),
    db.from("hackathon_team_members").select("team_id").eq("hackathon_id", sprintId).eq("user_id", userId).maybeSingle(),
  ]);

  const registered = reg.data && !reg.data.withdrawn_at;
  const role: ViewerRole = registered
    ? "participant"
    : judge.data?.accepted_at
      ? "judge"
      : judge.data
        ? "invited_judge"
        : isActive || isAdmin
          ? "spectator"
          : "outsider";

  return {
    role,
    isAdmin,
    isActive,
    mode: registered ? (reg.data!.mode as "random" | "team") : null,
    teamId: registered ? ((member.data?.team_id as string | undefined) ?? (reg.data!.team_id as string | null)) : null,
  };
}

async function loadTeams(db: SupabaseClient, sprintId: string, withActivity: boolean): Promise<ArenaTeam[]> {
  const [teams, members, activity] = await Promise.all([
    db
      .from("hackathon_teams")
      .select("id, name, slug, emblem, color, is_random_matched, created_at")
      .eq("hackathon_id", sprintId)
      .order("created_at"),
    db.from("hackathon_team_members").select("team_id, user_id, role, joined_at").eq("hackathon_id", sprintId),
    withActivity ? db.rpc("get_team_activity", { p_hackathon_id: sprintId }) : Promise.resolve({ data: null }),
  ]);
  if (!teams.data || teams.data.length === 0) return [];

  const ids = Array.from(new Set((members.data ?? []).map((m) => m.user_id as string)));
  const people = new Map<string, ArenaPerson>();
  if (ids.length > 0) {
    const { data } = await db.from("profiles").select("id, full_name, username, stage").in("id", ids);
    for (const p of data ?? []) people.set(p.id as string, p as ArenaPerson);
  }
  const pulse = new Map<string, ArenaTeam["activity"]>();
  for (const a of (activity.data as (NonNullable<ArenaTeam["activity"]> & { team_id: string })[] | null) ?? []) {
    pulse.set(a.team_id, a);
  }

  return teams.data.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    slug: t.slug as string,
    emblem: (t.emblem as string | null) ?? null,
    color: (t.color as string | null) ?? null,
    is_random_matched: Boolean(t.is_random_matched),
    members: (members.data ?? [])
      .filter((m) => m.team_id === t.id)
      .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : String(a.joined_at).localeCompare(String(b.joined_at))))
      .map((m) => ({
        ...(people.get(m.user_id as string) ?? { id: m.user_id as string, full_name: null, username: null, stage: null }),
        role: m.role as "owner" | "member",
      })),
    activity: pulse.get(t.id as string) ?? null,
  }));
}

async function loadRegistrants(db: SupabaseClient, sprintId: string): Promise<Registrant[]> {
  // Migration 024. Until it's applied the list is simply empty.
  const { data, error } = await db.rpc("hackathon_registrants", { p_hackathon_id: sprintId });
  if (error) return [];
  return ((data ?? []) as (Omit<Registrant, "id"> & { user_id: string })[]).map((r) => ({
    id: r.user_id,
    full_name: r.full_name,
    username: r.username,
    stage: r.stage,
    registered_at: r.registered_at,
  }));
}

async function loadAwards(db: SupabaseClient, sprintId: string): Promise<Award[]> {
  const { data: awards } = await db
    .from("hackathon_awards")
    .select("id, award_type, custom_label, submission_id, created_at")
    .eq("hackathon_id", sprintId)
    .order("created_at");
  if (!awards || awards.length === 0) return [];

  const subIds = Array.from(new Set(awards.map((a) => a.submission_id as string)));
  const { data: subs } = await db
    .from("hackathon_submissions")
    .select("id, project_name, tagline, team_id")
    .in("id", subIds);
  const teamIds = Array.from(new Set((subs ?? []).map((s) => s.team_id as string)));
  const { data: teams } = teamIds.length
    ? await db.from("hackathon_teams").select("id, name").in("id", teamIds)
    : { data: [] as { id: string; name: string }[] };
  const subById = new Map((subs ?? []).map((s) => [s.id as string, s]));
  const teamName = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));

  return awards.map((a) => {
    const s = subById.get(a.submission_id as string);
    return {
      id: a.id as string,
      award_type: a.award_type as Award["award_type"],
      custom_label: (a.custom_label as string | null) ?? null,
      project_name: (s?.project_name as string | undefined) ?? null,
      tagline: (s?.tagline as string | null | undefined) ?? null,
      team_name: s ? (teamName.get(s.team_id as string) ?? null) : null,
    };
  });
}

async function loadNextSprint(db: SupabaseClient, exceptNumber: number): Promise<SprintLink | null> {
  const { data } = await db
    .from("hackathon_overview")
    .select("number, title, state, registration_opens_at, starts_at")
    .eq("is_published", true)
    .in("state", ["upcoming", "registration"])
    .neq("number", exceptNumber)
    .order("starts_at")
    .limit(1);
  return ((data ?? [])[0] as SprintLink | undefined) ?? null;
}

/**
 * The whole Sprint page for one viewer. Each list is read only in the states
 * that show it, so a Sprint that hasn't opened registration doesn't query teams.
 */
export async function loadSprintPage(
  db: SupabaseClient,
  sprint: SprintRow,
  userId: string,
  opts: { isAdmin: boolean; isActive: boolean },
): Promise<SprintPageData> {
  const phase = sprint.phase;
  const showsTeams = ["registration", "teams_locked", "live", "judging", "revealed"].includes(phase);
  const showsActivity = ["live", "judging", "revealed"].includes(phase);

  const [viewer, teams, registrants, awards] = await Promise.all([
    loadViewer(db, sprint.id, userId, opts.isAdmin, opts.isActive),
    showsTeams ? loadTeams(db, sprint.id, showsActivity) : Promise.resolve([]),
    phase === "registration" ? loadRegistrants(db, sprint.id) : Promise.resolve(null),
    sprint.state === "revealed" ? loadAwards(db, sprint.id) : Promise.resolve([]),
  ]);

  const nextSprint =
    viewer.role === "spectator" || viewer.role === "outsider" ? await loadNextSprint(db, sprint.number) : null;

  return { sprint, viewer, teams, registrants, awards, nextSprint };
}
