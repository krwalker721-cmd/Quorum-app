import { createClient as createSbClient } from "@supabase/supabase-js";

/**
 * Posts the lobby's milestone messages that are due ("Teams are locked",
 * "Sprint is LIVE", "1 hour left", "Submissions are locked", "Results are
 * in!"). There's no per-minute cron on Vercel Hobby, so the Sprint page, the
 * lobby page and the timing check every open Sprint page makes all call this.
 * The database posts each milestone exactly once, so callers needn't
 * coordinate. Best-effort: a failure is logged and the page carries on.
 */
export async function postLobbyMilestones(sprintId: string): Promise<void> {
  try {
    const db = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-quorum-via": "lobby milestones" } },
    });
    const { error } = await db.rpc("hackathon_post_lobby_milestones", { p_hackathon_id: sprintId });
    // PGRST202: migration 029 isn't applied yet. Nothing to post until it is.
    if (error && error.code !== "PGRST202") console.error("lobby milestones failed:", error.message);
  } catch (e) {
    console.error("lobby milestones failed:", e);
  }
}
