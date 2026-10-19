import type { SupabaseClient } from "@supabase/supabase-js";

// The Hackathon tab in the sidebar: whether it shows, and when to mark it LIVE.
//
// The tab is for active members (trial included). Someone whose trial or
// subscription has run out still sees it if they registered for, or judge, a
// Sprint: their access to that Sprint continues (decision 12).
//
// LIVE is worked out in the browser from each Sprint's kickoff and deadline, so
// the label appears and disappears on time without a page load. A paused or
// cancelled Sprint is never LIVE; resuming reaches the label on the next load.

export type LiveWindow = { starts_at: string; ends_at: string };
export type HackathonNav = { show: boolean; windows: LiveWindow[] };

export async function getHackathonNav(
  db: SupabaseClient,
  userId: string,
  hasFullAccess: boolean,
): Promise<HackathonNav> {
  const [windows, involved] = await Promise.all([
    db
      .from("hackathon_overview")
      .select("starts_at, ends_at")
      .eq("is_published", true)
      .is("status_override", null)
      .gt("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(10),
    hasFullAccess ? Promise.resolve(true) : isInvolved(db, userId),
  ]);

  return {
    show: hasFullAccess || involved,
    windows: ((windows.data ?? []) as LiveWindow[]).filter((w) => w.starts_at && w.ends_at),
  };
}

async function isInvolved(db: SupabaseClient, userId: string): Promise<boolean> {
  const [reg, judge, admin] = await Promise.all([
    db.from("hackathon_registrations").select("id").eq("user_id", userId).is("withdrawn_at", null).limit(1),
    db.from("hackathon_judges").select("id").eq("user_id", userId).limit(1),
    db.from("profiles").select("is_admin").eq("id", userId).maybeSingle(),
  ]);
  return (reg.data?.length ?? 0) > 0 || (judge.data?.length ?? 0) > 0 || Boolean(admin.data?.is_admin);
}

/** Whether any window contains `now`. */
export function isLiveAt(windows: LiveWindow[], now: number): boolean {
  return windows.some((w) => Date.parse(w.starts_at) <= now && now < Date.parse(w.ends_at));
}
