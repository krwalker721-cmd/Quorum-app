// What the Hackathon tab needs to know about a Sprint's timing, shared by the
// server pages and the client pieces that tick. No server imports here.
//
// State is derived in the database (hackathon_overview, migration 018); this
// file never recomputes it for display. It only answers "which Sprint is the
// current one", "what does this state count down to", and "when does the state
// next change", so the page can refresh itself at that moment.

export type SprintState =
  | "draft"
  | "upcoming"
  | "registration"
  | "teams_locked"
  | "live"
  | "judging"
  | "revealed"
  | "paused"
  | "cancelled";

/** The phase ignores pause/cancel: where the Sprint's (possibly frozen) clock stands. */
export type SprintPhase = Exclude<SprintState, "paused" | "cancelled">;

/** The columns of hackathon_overview the tab reads. Theme is NULL until kickoff. */
export type SprintRow = {
  id: string;
  number: number;
  slug: string;
  title: string;
  tagline: string | null;
  rules: string | null;
  theme: string | null;
  registration_opens_at: string | null;
  team_lock_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  judging_ends_at: string | null;
  reveal_at: string | null;
  lobby_closes_at: string | null;
  max_team_size: number;
  min_team_size: number;
  status_override: "paused" | "cancelled" | null;
  status_override_at: string | null;
  is_published: boolean;
  show_countdown_in_app: boolean;
  countdown_headline_override: string | null;
  updated_at: string;
  state: SprintState;
  phase: SprintPhase;
};

export const SPRINT_COLUMNS =
  "id, number, slug, title, tagline, rules, theme, registration_opens_at, team_lock_at, starts_at, ends_at, " +
  "judging_ends_at, reveal_at, lobby_closes_at, max_team_size, min_team_size, status_override, " +
  "status_override_at, is_published, show_countdown_in_app, countdown_headline_override, updated_at, state, phase";

/** Just the stored fields that decide timing and what the countdown shows. */
export type SprintTiming = Pick<
  SprintRow,
  | "number"
  | "registration_opens_at"
  | "team_lock_at"
  | "starts_at"
  | "ends_at"
  | "judging_ends_at"
  | "reveal_at"
  | "lobby_closes_at"
  | "status_override"
  | "status_override_at"
  | "is_published"
  | "show_countdown_in_app"
  | "countdown_headline_override"
  | "updated_at"
>;

export const TIMING_COLUMNS =
  "number, registration_opens_at, team_lock_at, starts_at, ends_at, judging_ends_at, reveal_at, " +
  "lobby_closes_at, status_override, status_override_at, is_published, show_countdown_in_app, " +
  "countdown_headline_override, updated_at";

export function toTiming(s: SprintTiming): SprintTiming {
  return {
    number: s.number,
    registration_opens_at: s.registration_opens_at,
    team_lock_at: s.team_lock_at,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    judging_ends_at: s.judging_ends_at,
    reveal_at: s.reveal_at,
    lobby_closes_at: s.lobby_closes_at,
    status_override: s.status_override,
    status_override_at: s.status_override_at,
    is_published: s.is_published,
    show_countdown_in_app: s.show_countdown_in_app,
    countdown_headline_override: s.countdown_headline_override,
    updated_at: s.updated_at,
  };
}

/** A string that changes whenever an admin changes anything timing-related. */
export function timingFingerprint(t: SprintTiming): string {
  const ms = (v: string | null) => (v ? Date.parse(v) : null);
  return JSON.stringify([
    ms(t.registration_opens_at),
    ms(t.team_lock_at),
    ms(t.starts_at),
    ms(t.ends_at),
    ms(t.judging_ends_at),
    ms(t.reveal_at),
    ms(t.lobby_closes_at),
    t.status_override,
    ms(t.status_override_at),
    t.is_published,
    t.show_countdown_in_app,
    t.countdown_headline_override,
    ms(t.updated_at),
  ]);
}

/**
 * The next moment the state changes on its own: the first of the five phase
 * boundaries still ahead (the same five hackathon_phase_at uses). None while
 * the Sprint is paused, cancelled or unpublished: then only an admin moves it.
 */
export function nextBoundary(t: SprintTiming, nowMs: number): number | null {
  if (!t.is_published || t.status_override) return null;
  for (const at of [t.registration_opens_at, t.team_lock_at, t.starts_at, t.ends_at, t.reveal_at]) {
    if (!at) continue;
    const ms = Date.parse(at);
    if (ms > nowMs) return ms;
  }
  return null;
}

type StageCountdown = { label: string; key: keyof SprintTiming; big: boolean };

/** What each state counts down to. Revealed, paused, cancelled and draft have none. */
export function stageCountdown(state: SprintState): StageCountdown | null {
  switch (state) {
    case "upcoming":
      return { label: "Registration opens in", key: "registration_opens_at", big: false };
    case "registration":
    case "teams_locked":
      return { label: "Kicks off in", key: "starts_at", big: false };
    case "live":
      return { label: "Submissions close in", key: "ends_at", big: true };
    case "judging":
      return { label: "Results revealed in", key: "reveal_at", big: false };
    default:
      return null;
  }
}

// Which Sprint /hackathon opens: the one that's happening, then the one about to.
// A paused Sprint ranks where its clock stopped. Cancelled and draft never count.
const RANK: Partial<Record<SprintPhase, number>> = {
  live: 0,
  judging: 1,
  teams_locked: 2,
  registration: 3,
  upcoming: 4,
  revealed: 5,
};

/** The most relevant published Sprint, or null when there's none to show. */
export function pickCurrentSprint<
  T extends Pick<SprintRow, "number" | "state" | "phase" | "is_published" | "starts_at" | "reveal_at">,
>(rows: T[]): T | null {
  const candidates = rows.filter(
    (r) => r.is_published && r.state !== "cancelled" && r.state !== "draft" && RANK[r.phase] !== undefined,
  );
  const time = (v: string | null) => (v ? Date.parse(v) : 0);
  candidates.sort((a, b) => {
    const ra = RANK[a.phase]!;
    const rb = RANK[b.phase]!;
    if (ra !== rb) return ra - rb;
    // Same stage: the most recent reveal among past Sprints, otherwise the one
    // that starts soonest.
    if (a.phase === "revealed") return time(b.reveal_at) - time(a.reveal_at);
    return time(a.starts_at) - time(b.starts_at) || a.number - b.number;
  });
  return candidates[0] ?? null;
}

export const STATE_LABEL: Record<SprintState, string> = {
  draft: "Draft",
  upcoming: "Announced",
  registration: "Registration open",
  teams_locked: "Teams locked",
  live: "Live",
  judging: "Judging",
  revealed: "Revealed",
  paused: "Paused",
  cancelled: "Cancelled",
};
