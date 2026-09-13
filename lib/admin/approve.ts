import type { SupabaseClient } from "@supabase/supabase-js";
import { assignUserToCohort } from "@/lib/cohorts";
import { initializeUserSubscription } from "@/lib/stripe-helpers";
import { createReferralCode, trackLoginEvent } from "@/lib/referral-helpers";
import { TRIAL_DAYS } from "@/lib/pricing";
import { sendEmail } from "@/lib/email/send";
import { approvedEmail } from "@/lib/email/templates";

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

export async function approveUser(
  admin: SupabaseClient,
  id: string,
  // notify: false approves silently. Open signup uses it: someone who was let
  // straight in doesn't need an email announcing it.
  opts: { notify?: boolean } = {},
): Promise<ApproveOutcome> {
  const { data: current, error: readErr } = await admin
    .from("profiles")
    .select("status, referred_by, email, full_name")
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

  // Tell them they're in. Every approval path runs through here, so single,
  // bulk, and a released group all send it. Best-effort: a failed email never
  // undoes an approval. The idempotency key absorbs a double-click.
  if (opts.notify !== false && current.email) {
    const sent = await sendEmail({
      to: current.email,
      ...approvedEmail({
        fullName: current.full_name,
        trialDays: current.referred_by ? TRIAL_DAYS.referred : TRIAL_DAYS.standard,
      }),
      idempotencyKey: `approved/${id}`,
    });
    if (!sent.ok) console.error("[approve] welcome email failed:", id, sent.error);
  }

  return { id, result: "approved", cohortId, cohortWarning };
}
