import { createAdminClient } from "@/lib/supabase/server";
import { LAPSE_GRACE_DAYS } from "@/lib/pricing";

// Lapse handling — what happens when a trial ends or a subscription stops.
//
// A cohort seat is scarce and rivalrous: twelve chairs, and a non-paying
// occupant costs the eleven paying members around them. So a lapsed account
// keeps read access to what it was part of, but gives the chair back.
//
// The seat isn't yanked the moment a card fails. LAPSE_GRACE_DAYS of grace runs
// first, with the trial banner escalating, because someone mid-conversation
// deserves a moment to sort out billing.
//
// Evaluated lazily on app load rather than by a cron, so it stays correct
// without depending on a scheduler being healthy. Every call is best-effort and
// must never block a page render.

export type LapseState =
  | { state: "ok" }
  | { state: "grace"; daysLeft: number }
  | { state: "released" };

/**
 * Resolve, and if necessary act on, a user's lapse state. Returns what the UI
 * should reflect. Idempotent — releasing an already-released seat is a no-op.
 */
export async function enforceLapse(userId: string): Promise<LapseState> {
  const supabase = createAdminClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, tier, trial_ends_at, lapsed_at, seat_released_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!sub) return { state: "ok" };

  // Paying (or genuinely still trialing) — clear any stale lapse marker so a
  // member who reactivates isn't left mid-grace.
  const paying = sub.status === "active" || sub.tier === "member" || sub.tier === "partner";
  const trialLive =
    sub.status === "trialing" &&
    sub.trial_ends_at != null &&
    new Date(sub.trial_ends_at).getTime() > Date.now();

  if (paying || trialLive) {
    if (sub.lapsed_at) {
      await supabase
        .from("subscriptions")
        .update({ lapsed_at: null, seat_released_at: null })
        .eq("user_id", userId);
    }
    return { state: "ok" };
  }

  if (sub.seat_released_at) return { state: "released" };

  // First observation of the lapse — start the grace clock from the trial end
  // where we know it, so a user who simply didn't open the app for a month
  // doesn't get a fresh grace window on their next visit.
  let lapsedAt = sub.lapsed_at ? new Date(sub.lapsed_at) : null;
  if (!lapsedAt) {
    lapsedAt = sub.trial_ends_at ? new Date(sub.trial_ends_at) : new Date();
    await supabase
      .from("subscriptions")
      .update({ lapsed_at: lapsedAt.toISOString() })
      .eq("user_id", userId);
  }

  const graceEndsAt = lapsedAt.getTime() + LAPSE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  const msLeft = graceEndsAt - Date.now();

  if (msLeft > 0) {
    return { state: "grace", daysLeft: Math.max(1, Math.ceil(msLeft / 86_400_000)) };
  }

  await releaseCohortSeat(userId);
  return { state: "released" };
}

/**
 * Return a lapsed member's cohort seat to the pool. Their posts stay — the room
 * keeps its history — and they keep read access; only the membership row goes.
 */
export async function releaseCohortSeat(userId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase.from("cohort_members").delete().eq("user_id", userId);

  await supabase
    .from("subscriptions")
    .update({ seat_released_at: new Date().toISOString() })
    .eq("user_id", userId);

  await supabase.from("profiles").update({ tier: "free" }).eq("id", userId);
}

/**
 * Whether this user should be auto-placed into a cohort when they have no
 * membership row. Guards the layout's auto-assign safety net: without this, a
 * seat released for non-payment would be handed straight back on next load.
 */
export async function isEligibleForCohortPlacement(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("seat_released_at")
    .eq("user_id", userId)
    .maybeSingle();
  return !sub?.seat_released_at;
}
