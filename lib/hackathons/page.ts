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
  userId: string;
  role: ViewerRole;
  isAdmin: boolean;
  isActive: boolean;
  /** Set for participants: random pool or own team, and the team if any. */
  mode: "random" | "team" | null;
  teamId: string | null;
  /** Registered once and withdrew (can come back while registration is open). */
  withdrawn: boolean;
  checkedInAt: string | null;
};

export type ArenaPerson = { id: string; full_name: string | null; username: string | null; stage: string | null };

/** A team's pulse (migration 027): counts and times only, never content. */
export type TeamPulse = {
  team_id: string;
  activity_count: number;
  last_active_at: string | null;
  has_submitted: boolean;
  submitted_at: string | null;
};

export type ArenaTeam = {
  id: string;
  name: string;
  slug: string;
  emblem: string | null;
  color: string | null;
  is_random_matched: boolean;
  is_open_to_requests: boolean;
  /** The team's size limit: its own override, or the Sprint's. */
  max_size: number;
  members: (ArenaPerson & { role: "owner" | "member"; cohort: string | null })[];
  pulse: TeamPulse | null;
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

export type RegistrationCounts = { registered: number; random_pool: number; looking: number; on_teams: number; teams: number };

/** The join queue and the team panel (migration 025), for the viewer. */
export type QueueData = {
  counts: RegistrationCounts | null;
  /** Your pending requests to join teams. */
  myRequests: { id: string; team_id: string; team_name: string }[];
  /** Invitations waiting for your answer. */
  myInvitations: { id: string; team_id: string; team_name: string; invited_by: string | null }[];
  /** Your team, when you're on one. */
  team: {
    id: string;
    isOwner: boolean;
    /** Owner, or any member of a matched team: may rename. */
    canEdit: boolean;
    /** Pending requests (the owner sees them). */
    requests: { id: string; person: ArenaPerson; message: string | null }[];
    /** Pending invitations the team has sent. */
    invitations: { id: string; person: ArenaPerson }[];
    /** The invite code, if the owner has made one. */
    code: string | null;
  } | null;
};

export type SprintPageData = {
  sprint: SprintRow;
  viewer: Viewer;
  teams: ArenaTeam[];
  registrants: Registrant[] | null; // null: not shown in this state
  awards: Award[];
  /** For a spectator's "join the next one": the next announced Sprint, if any. */
  nextSprint: SprintLink | null;
  /** From registration through the live Sprint; null otherwise. */
  queue: QueueData | null;
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
      .select("mode, team_id, withdrawn_at, checked_in_at")
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
    userId,
    role,
    isAdmin,
    isActive,
    mode: registered ? (reg.data!.mode as "random" | "team") : null,
    teamId: registered ? ((member.data?.team_id as string | undefined) ?? (reg.data!.team_id as string | null)) : null,
    withdrawn: Boolean(reg.data?.withdrawn_at),
    checkedInAt: registered ? ((reg.data!.checked_in_at as string | null) ?? null) : null,
  };
}

async function loadPeople(db: SupabaseClient, ids: string[]): Promise<Map<string, ArenaPerson>> {
  const people = new Map<string, ArenaPerson>();
  const unique = Array.from(new Set(ids));
  if (unique.length > 0) {
    const { data } = await db.from("profiles").select("id, full_name, username, stage").in("id", unique);
    for (const p of data ?? []) people.set(p.id as string, p as ArenaPerson);
  }
  return people;
}
const personOr = (people: Map<string, ArenaPerson>, id: string): ArenaPerson =>
  people.get(id) ?? { id, full_name: null, username: null, stage: null };

// What the arena reads: names, rosters, cohort names, and the pulse. Nothing
// from a team's room or submission (sealed, and not asked for here either).
async function loadTeams(db: SupabaseClient, sprint: SprintRow, withActivity: boolean): Promise<ArenaTeam[]> {
  const [teams, members, pulses, cohorts] = await Promise.all([
    db
      .from("hackathon_teams")
      .select("id, name, slug, emblem, color, is_random_matched, is_open_to_requests, max_size_override, created_at")
      .eq("hackathon_id", sprint.id)
      .order("created_at"),
    db.from("hackathon_team_members").select("team_id, user_id, role, joined_at").eq("hackathon_id", sprint.id),
    withActivity
      ? db.from("hackathon_team_pulse").select("team_id, activity_count, last_active_at, has_submitted, submitted_at").eq("hackathon_id", sprint.id)
      : Promise.resolve({ data: null }),
    db.rpc("hackathon_arena_cohorts", { p_hackathon_id: sprint.id }),
  ]);
  if (!teams.data || teams.data.length === 0) return [];

  const people = await loadPeople(db, (members.data ?? []).map((m) => m.user_id as string));
  const pulse = new Map(((pulses.data as TeamPulse[] | null) ?? []).map((p) => [p.team_id, p]));
  // Migration 027. Until it's applied, cohorts are simply left off.
  const cohortOf = new Map(
    ((cohorts.error ? [] : cohorts.data) as { user_id: string; cohort_name: string }[] | null ?? []).map((c) => [c.user_id, c.cohort_name]),
  );

  return teams.data.map((t) => ({
    id: t.id as string,
    name: t.name as string,
    slug: t.slug as string,
    emblem: (t.emblem as string | null) ?? null,
    color: (t.color as string | null) ?? null,
    is_random_matched: Boolean(t.is_random_matched),
    is_open_to_requests: Boolean(t.is_open_to_requests),
    max_size: (t.max_size_override as number | null) ?? sprint.max_team_size,
    members: (members.data ?? [])
      .filter((m) => m.team_id === t.id)
      .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : String(a.joined_at).localeCompare(String(b.joined_at))))
      .map((m) => ({
        ...personOr(people, m.user_id as string),
        role: m.role as "owner" | "member",
        cohort: cohortOf.get(m.user_id as string) ?? null,
      })),
    pulse: pulse.get(t.id as string) ?? null,
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

/**
 * The join queue and team panel. RLS scopes every read: your own requests and
 * invitations, and your team's requests, invitations and code.
 */
async function loadQueue(
  db: SupabaseClient,
  sprint: SprintRow,
  viewer: Viewer,
  teams: ArenaTeam[],
): Promise<QueueData> {
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const myTeam = viewer.teamId ? teams.find((t) => t.id === viewer.teamId) : undefined;
  const isOwner = !!myTeam?.members.some((m) => m.id === viewer.userId && m.role === "owner");

  const [counts, myRequests, myInvitations, teamRequests, teamInvitations, code] = await Promise.all([
    db.rpc("hackathon_registration_counts", { p_hackathon_id: sprint.id }).maybeSingle(),
    db
      .from("hackathon_team_join_requests")
      .select("id, team_id")
      .eq("hackathon_id", sprint.id)
      .eq("user_id", viewer.userId)
      .eq("status", "pending"),
    db
      .from("hackathon_team_invitations")
      .select("id, team_id, invited_by")
      .eq("hackathon_id", sprint.id)
      .eq("user_id", viewer.userId)
      .eq("status", "pending"),
    myTeam && isOwner
      ? db.from("hackathon_team_join_requests").select("id, user_id, message").eq("team_id", myTeam.id).eq("status", "pending").order("created_at")
      : Promise.resolve({ data: [] as { id: string; user_id: string; message: string | null }[] }),
    myTeam
      ? db.from("hackathon_team_invitations").select("id, user_id").eq("team_id", myTeam.id).eq("status", "pending").order("created_at")
      : Promise.resolve({ data: [] as { id: string; user_id: string }[] }),
    myTeam && isOwner
      ? db.from("hackathon_team_invite_codes").select("code").eq("team_id", myTeam.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const people = await loadPeople(db, [
    ...(teamRequests.data ?? []).map((r) => r.user_id as string),
    ...(teamInvitations.data ?? []).map((r) => r.user_id as string),
    ...(myInvitations.data ?? []).map((r) => r.invited_by as string).filter(Boolean),
  ]);

  return {
    counts: (counts.data as RegistrationCounts | null) ?? null,
    myRequests: (myRequests.data ?? []).map((r) => ({
      id: r.id as string,
      team_id: r.team_id as string,
      team_name: teamName.get(r.team_id as string) ?? "a team",
    })),
    myInvitations: (myInvitations.data ?? []).map((r) => ({
      id: r.id as string,
      team_id: r.team_id as string,
      team_name: teamName.get(r.team_id as string) ?? "a team",
      invited_by: r.invited_by ? (people.get(r.invited_by as string)?.full_name ?? null) : null,
    })),
    team: myTeam
      ? {
          id: myTeam.id,
          isOwner,
          canEdit: isOwner || myTeam.is_random_matched,
          requests: (teamRequests.data ?? []).map((r) => ({
            id: r.id as string,
            person: personOr(people, r.user_id as string),
            message: (r.message as string | null) ?? null,
          })),
          invitations: (teamInvitations.data ?? []).map((r) => ({
            id: r.id as string,
            person: personOr(people, r.user_id as string),
          })),
          code: ((code.data as { code: string } | null)?.code as string | undefined) ?? null,
        }
      : null,
  };
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
  const showsActivity = ["teams_locked", "live", "judging", "revealed"].includes(phase);
  const showsQueue = sprint.state !== "cancelled" && ["registration", "teams_locked", "live"].includes(phase);

  const [viewer, teams, registrants, awards] = await Promise.all([
    loadViewer(db, sprint.id, userId, opts.isAdmin, opts.isActive),
    showsTeams ? loadTeams(db, sprint, showsActivity) : Promise.resolve([]),
    phase === "registration" ? loadRegistrants(db, sprint.id) : Promise.resolve(null),
    sprint.state === "revealed" ? loadAwards(db, sprint.id) : Promise.resolve([]),
  ]);

  const [nextSprint, queue] = await Promise.all([
    viewer.role === "spectator" || viewer.role === "outsider" ? loadNextSprint(db, sprint.number) : Promise.resolve(null),
    showsQueue ? loadQueue(db, sprint, viewer, teams) : Promise.resolve(null),
  ]);

  return { sprint, viewer, teams, registrants, awards, nextSprint, queue };
}
