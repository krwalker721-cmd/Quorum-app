// The Sprint lobby (Phase 7, migration 029): what both the browser and the
// server need. Posting milestones is server-only: lib/hackathons/lobbyMilestones.ts.

/** Matches the column default (029, reworded in 037); new Buildathons start with it. */
export { DEFAULT_LOBBY_WELCOME as LOBBY_WELCOME_DEFAULT } from "./defaults";

/** Members' messages are at most this long (enforced in the database). */
export const LOBBY_MAX_LENGTH = 1000;
