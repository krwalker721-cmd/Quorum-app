import { createAdminClient } from "@/lib/supabase/server";
import { foundingSeatsRemaining } from "@/lib/plans";
import { dueReminder } from "./reminder-schedule";
import { sendEmail } from "./send";
import { trialReminderEmail } from "./templates";

// The trial-expiry gap (LAUNCH.md §4a): a card-free trial exists only in
// public.subscriptions, so Stripe never warns the member it's ending, and the
// in-app banner only reaches someone who opens the app. This emails them.

const DAY_MS = 86_400_000;
// Stay under Resend's per-second rate limit.
const SEND_SPACING_MS = 600;

type ReminderProfile = {
  email: string | null;
  full_name: string | null;
  notification_preferences: Record<string, boolean> | null;
};

type TrialRow = {
  user_id: string;
  trial_ends_at: string;
  profiles: ReminderProfile | ReminderProfile[] | null;
};

export type ReminderRun = {
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
};

export async function sendTrialReminders(now = new Date()): Promise<ReminderRun> {
  const admin = createAdminClient();
  const run: ReminderRun = { considered: 0, sent: 0, skipped: 0, failed: 0, errors: [] };

  // Card-free trials of approved members, ending within the widest window. A
  // Stripe trial (the referral card path) has a stripe_subscription_id, and
  // Stripe sends that member its own 7-day reminder; a second email would
  // confuse. A suspended member isn't "approved", so they're left out too.
  const horizon = new Date(now.getTime() + 7.5 * DAY_MS);
  const { data, error } = await admin
    .from("subscriptions")
    .select("user_id, trial_ends_at, profiles!inner(email, full_name, notification_preferences)")
    .eq("status", "trialing")
    .is("stripe_subscription_id", null)
    .gt("trial_ends_at", now.toISOString())
    .lte("trial_ends_at", horizon.toISOString())
    .eq("profiles.status", "approved");

  if (error) {
    run.errors.push(`query: ${error.message}`);
    return run;
  }

  let seatsLeft: number | null = null;

  for (const row of (data ?? []) as unknown as TrialRow[]) {
    run.considered++;
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const trialEndsAt = new Date(row.trial_ends_at);
    const mark = dueReminder(trialEndsAt, now);

    // The card-free trial never auto-charges, so no auto-renewal law requires
    // this email, and the Settings opt-out is honoured.
    if (
      !mark ||
      !profile?.email ||
      profile.notification_preferences?.email_trial_ending === false
    ) {
      run.skipped++;
      continue;
    }

    // Claim the send before making it. The primary key makes the claim atomic,
    // so two overlapping runs can't both email the same person for one mark.
    const claim = { user_id: row.user_id, days_before: mark, trial_ends_at: row.trial_ends_at };
    const { data: claimed, error: claimErr } = await admin
      .from("trial_reminder_sends")
      .upsert(claim, { onConflict: "user_id,days_before,trial_ends_at", ignoreDuplicates: true })
      .select("user_id");
    if (claimErr) {
      run.failed++;
      run.errors.push(`${row.user_id}: claim failed: ${claimErr.message}`);
      continue;
    }
    if (!claimed?.length) {
      run.skipped++; // already sent
      continue;
    }

    seatsLeft ??= await foundingSeatsRemaining();
    const result = await sendEmail({
      to: profile.email,
      ...trialReminderEmail({
        fullName: profile.full_name,
        trialEndsAt,
        now,
        foundingSeatsLeft: seatsLeft,
      }),
      idempotencyKey: `trial-reminder/${row.user_id}/${mark}/${trialEndsAt.getTime()}`,
    });

    if (result.ok) {
      run.sent++;
    } else {
      // Release the claim so the next run tries again.
      await admin.from("trial_reminder_sends").delete().match(claim);
      run.failed++;
      run.errors.push(`${row.user_id}: ${result.error}`);
    }

    await new Promise((r) => setTimeout(r, SEND_SPACING_MS));
  }

  return run;
}
