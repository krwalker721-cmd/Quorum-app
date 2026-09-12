import type { SupabaseClient } from "@supabase/supabase-js";
import { assignUserToCohort } from "@/lib/cohorts";
import { initializeUserSubscription } from "@/lib/stripe-helpers";
import { createReferralCode, trackLoginEvent } from "@/lib/referral-helpers";

// Everything "approve" means, in one place.
//
// The single approve button and the admin panel's bulk approve used to do
// different things: bulk approve only flipped the status and started a
// standard trial for everyone, so a referred founder got 30 days instead of the
// 45 the Terms promise, and no free-month window. Both routes call this now, so
// they can't drift apart again.

export type ApproveOutcome = {
  id: string;
  /** "skipped" = already approved or suspended; nothing was changed. */
  result: "approved" | "skipped" | "failed";
  reason?: string;
  cohortId?: string | null;
  cohortWarning?: string | null;
};

export async function approveUser(admin: SupabaseClient, id: string): Promise<ApproveOutcome> {
  const { data: current, error: readErr } = await admin
    .from("profiles")
    .select("status, referred_by")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { id, result: "failed", reason: readErr.message };
  if (!current) return { id, result: "failed", reason: "no such user" };

  // Approving again would restart the trial clock (initializeUserSubscription
  // upserts a fresh trial_ends_at), which is easy to do by accident from a
  // bulk selection. A suspended member comes back through "unsuspend" instead,
  // which keeps their trial.
  if (current.status === "approved" || current.status === "suspended") {
    return { id, result: "skipped", reason: `already ${current.status}` };
  }

  const { error } = await admin.from("profiles").update({ status: "approved" }).eq("id", id);
  if (error) return { id, result: "failed", reason: error.message };

  // Start the trial: the longer referred trial and the 48h free-month window
  // when the member arrived through a referral link. Best-effort.
  try {
    await initializeUserSubscription(id, !!current.referred_by);
  } catch (e) {
    console.error("[approve] initializeUserSubscription failed:", id, e);
  }

  // Referral code, and day 1 toward the three-day activity gate. Best-effort.
  try {
    await createReferralCode(id);
    await trackLoginEvent(id);
  } catch (e) {
    console.error("[approve] referral code / login event setup failed:", id, e);
  }

  // A cohort failure doesn't undo the approval — the app layout also assigns a
  // cohort on the member's first visit.
  let cohortId: string | null = null;
  let cohortWarning: string | null = null;
  try {
    cohortId = await assignUserToCohort(admin, id);
  } catch (e) {
    cohortWarning = e instanceof Error ? e.message : "cohort assignment failed";
  }

  return { id, result: "approved", cohortId, cohortWarning };
}
