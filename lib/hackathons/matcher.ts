import { createClient as createSbClient } from "@supabase/supabase-js";

// Running the team matcher (migration 026) from the server. It runs once per
// Sprint: the database records matched_at and every later call is a no-op, so
// all three callers can fire without coordinating:
//   * the Sprint page, when it loads after team lock (it reloads itself at
//     team lock, so people see their team the moment teams lock);
//   * /api/cron/hackathon-matcher, if a per-minute Vercel Cron is set up
//     (needs Vercel Pro; see docs/hackathon-plan.md);
//   * the admin console's "run team matcher" button (through adminDb, so the
//     log names the admin).

function matcherDb(via: string) {
  return createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-quorum-via": via } },
  });
}

type DueRow = { id: string; team_lock_at: string | null; ends_at: string | null };

/** Published, unfrozen, unmatched, and past team lock. */
function isDue(s: DueRow & { matched_at: string | null; status_override: string | null; is_published: boolean }) {
  return (
    s.is_published &&
    !s.status_override &&
    !s.matched_at &&
    !!s.team_lock_at &&
    Date.parse(s.team_lock_at) <= Date.now()
  );
}

/**
 * Runs the matcher for one Sprint if it's due. Best-effort: a failure is
 * logged and the page carries on (the next load, or the admin, tries again).
 */
export async function runMatcherIfDue(sprintId: string, via = "team matcher (page load)"): Promise<void> {
  try {
    const db = matcherDb(via);
    const { data } = await db
      .from("hackathons")
      .select("id, team_lock_at, ends_at, matched_at, status_override, is_published")
      .eq("id", sprintId)
      .maybeSingle();
    if (!data || !isDue(data)) return;
    const { error } = await db.rpc("hackathon_run_matcher", { p_hackathon_id: sprintId });
    if (error) console.error("team matcher failed:", error.message);
  } catch (e) {
    console.error("team matcher failed:", e);
  }
}

/** Every Sprint that's due, for the cron route. */
export async function runDueMatchers(via: string): Promise<{ id: string; ok: boolean; error?: string }[]> {
  const db = matcherDb(via);
  const { data, error } = await db
    .from("hackathons")
    .select("id")
    .eq("is_published", true)
    .is("status_override", null)
    .is("matched_at", null)
    .lte("team_lock_at", new Date().toISOString());
  if (error) throw new Error(error.message);

  const results = [];
  for (const { id } of data ?? []) {
    const r = await db.rpc("hackathon_run_matcher", { p_hackathon_id: id });
    results.push(r.error ? { id, ok: false, error: r.error.message } : { id, ok: true });
  }
  return results;
}
