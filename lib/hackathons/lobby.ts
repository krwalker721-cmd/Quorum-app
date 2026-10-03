// The Sprint lobby (Phase 7, migration 029): what both the browser and the
// server need. Posting milestones is server-only: lib/hackathons/lobbyMilestones.ts.

/** Matches the column default in migration 029; new Sprints start with it. */
export const LOBBY_WELCOME_DEFAULT =
  "This is the lobby for everyone in the Sprint — banter, questions, cheering each other on. Keep your team's idea under wraps until the reveal!";

/** Members' messages are at most this long (enforced in the database). */
export const LOBBY_MAX_LENGTH = 1000;
