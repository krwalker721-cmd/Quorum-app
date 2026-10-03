// Shapes returned by /api/admin/hackathons.

export type SprintRow = {
  id: string;
  number: number;
  slug: string;
  title: string;
  state: string;
  phase: string;
  is_published: boolean;
  status_override: string | null;
  registration_opens_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  reveal_at: string | null;
  participant_count: number;
  team_count: number;
  submission_count: number;
};

export type Sprint = {
  id: string;
  number: number;
  slug: string;
  title: string;
  tagline: string | null;
  theme_hidden: string | null;
  rules: string | null;
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
  show_countdown_on_landing: boolean;
  countdown_headline_override: string | null;
  /** Pinned at the top of the lobby (migration 029); null hides it. */
  lobby_welcome: string | null;
  updated_at: string;
  /** Set once the team matcher has run (migration 026). */
  matched_at: string | null;
  match_report: MatchReport | null;
  state: string;
  phase: string;
};

/** What hackathon_run_matcher recorded (migration 026). */
export type MatchReport = {
  matched_at: string;
  skipped?: string;
  already_matched?: boolean;
  pool: number;
  team_size: number | null;
  new_teams: { team_id: string; name: string; members: string[] }[];
  joined_open_teams: { team_id: string; name: string; members: string[] }[];
  flagged: { user_id: string; name: string | null }[];
  same_cohort_pairs: number;
};

export type Participant = {
  user_id: string;
  name: string;
  email: string | null;
  cohort: string | null;
  mode: "random" | "team";
  team_id: string | null;
  team_name: string | null;
  checked_in_at: string | null;
  created_at: string;
  withdrawn_at: string | null;
  last_active_at: string | null;
};

export type TeamMember = { user_id: string; name: string; role: "owner" | "member"; joined_at: string };

export type Team = {
  id: string;
  name: string;
  slug: string;
  emblem: string | null;
  color: string | null;
  is_random_matched: boolean;
  is_open_to_requests: boolean;
  max_size_override: number | null;
  limit: number;
  /** A draft until is_complete (migration 030). */
  submission: { project_name: string | null; updated_at: string; is_complete: boolean } | null;
  members: TeamMember[];
};

export type Judge = {
  id: string;
  user_id: string | null;
  invite_email: string | null;
  name: string | null;
  email: string | null;
  invited_at: string;
  accepted_at: string | null;
};

export type LobbyMessage = {
  id: string;
  user_id: string | null;
  author: string;
  body: string;
  is_system: boolean;
  is_pinned: boolean;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export type LogEntry = {
  id: number;
  area: string;
  action: string;
  summary: string | null;
  subject: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  actor: string;
  created_at: string;
};

export type SprintDetail = {
  sprint: Sprint;
  participants: Participant[];
  teams: Team[];
  judges: Judge[];
  lobby: LobbyMessage[];
  log: LogEntry[];
};
