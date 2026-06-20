import { createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { applyMonthlyBonusToStripe } from "@/lib/monthly-bonus-stripe";

// Referral data layer (Session 7). These helpers run server-side from the
// webhook, the signup claim route, the API routes, and scheduled jobs — often
// writing to a *different* user's rows (e.g. notifying a referrer) — so they use
// the service-role client (createAdminClient), which bypasses RLS. Access is
// always scoped by explicit user_id / referrer_id filters.
//
// The `notifications` table predates this feature and has NOT NULL `kind` +
// `message` columns alongside the newer `type` / `source_*` / `read` columns, so
// every insert here goes through `notify()` which always supplies both.

type AdminClient = ReturnType<typeof createAdminClient>;

// ---------------------------------------------------------------------------
// Notification copy keyed by referral notification type. Kept in sync with the
// presentation metadata in lib/notificationMeta.ts.
// ---------------------------------------------------------------------------
const REFERRAL_NOTICE_COPY: Record<string, string> = {
  referral_pending: "someone just joined using your link",
  referral_activated:
    "a referral activated their account — your milestone progress updated",
  referral_inactive:
    "a referral is no longer active — your monthly bonus was recalculated",
  referral_nudge:
    "a referral hasn't activated yet — they have 24 hours to claim their free month",
  referral_churned: "a referral cancelled their account",
  referral_reward: "you earned a referral reward!",
  monthly_bonus_updated: "your monthly referral bonus has been updated",
};

async function notify(
  supabase: AdminClient,
  userId: string,
  type: keyof typeof REFERRAL_NOTICE_COPY,
  opts: { sourceId?: string; message?: string; payload?: Record<string, unknown> } = {},
): Promise<void> {
  await supabase.from("notifications").insert({
    user_id: userId,
    kind: type,
    type,
    message: opts.message ?? REFERRAL_NOTICE_COPY[type],
    source_id: opts.sourceId ?? null,
    source_type: "referral",
    read: false,
    payload: opts.payload ?? null,
  });
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

// Generate a candidate referral code, e.g. "qrm_a1b2c3" (URL-safe).
export function generateReferralCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const randomPart = Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
  return `qrm_${randomPart}`;
}

// Create (or return existing) referral code for a user. Called on approval.
export async function createReferralCode(userId: string): Promise<string> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.code) return existing.code;

  // Insert with retry on the (rare) unique-collision.
  let code = generateReferralCode();
  let attempts = 0;
  while (attempts < 10) {
    const { error } = await supabase
      .from("referral_codes")
      .insert({ user_id: userId, code });
    if (!error) break;
    // unique_violation on user_id means a code already exists — fetch and return.
    if (error.code === "23505") {
      const { data } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", userId)
        .maybeSingle();
      if (data?.code) {
        await supabase
          .from("profiles")
          .update({ referral_code: data.code })
          .eq("id", userId);
        return data.code;
      }
    }
    code = generateReferralCode();
    attempts++;
  }

  // Cache on the profile for quick reads.
  await supabase.from("profiles").update({ referral_code: code }).eq("id", userId);
  return code;
}

// ---------------------------------------------------------------------------
// Validation + referral creation
// ---------------------------------------------------------------------------

export async function validateReferralCode(code: string): Promise<{
  valid: boolean;
  referrerId?: string;
  reason?: string;
}> {
  const supabase = createAdminClient();

  const { data: referralCode } = await supabase
    .from("referral_codes")
    .select("user_id, active")
    .eq("code", code)
    .maybeSingle();

  if (!referralCode) return { valid: false, reason: "Code not found" };
  if (!referralCode.active) return { valid: false, reason: "Code is inactive" };

  // Free-tier referrers cap out at 3 non-churned referrals.
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", referralCode.user_id)
    .single();

  if (profile?.tier === "free") {
    const { count } = await supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", referralCode.user_id)
      .neq("status", "churned");
    if ((count || 0) >= 3) {
      return { valid: false, reason: "Referrer has reached free tier limit" };
    }
  }

  return { valid: true, referrerId: referralCode.user_id };
}

// Create a referral record when a referred user signs up. Idempotent on the
// referrals.referred_id unique constraint.
export async function createReferral(
  referrerId: string,
  referredId: string,
  code: string,
): Promise<void> {
  if (referrerId === referredId) return; // can't refer yourself

  const supabase = createAdminClient();

  // Skip if this user was already referred.
  const { data: existing } = await supabase
    .from("referrals")
    .select("id")
    .eq("referred_id", referredId)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabase.from("referrals").insert({
    referrer_id: referrerId,
    referred_id: referredId,
    code,
    status: "pending",
  });
  if (error) return;

  await supabase
    .from("profiles")
    .update({ referred_by: referrerId })
    .eq("id", referredId);

  await notify(supabase, referrerId, "referral_pending", { sourceId: referredId });
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

// Activate a referral (referred user added a card). Idempotent.
export async function activateReferral(referredId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: referral } = await supabase
    .from("referrals")
    .select("referrer_id, status")
    .eq("referred_id", referredId)
    .maybeSingle();

  if (!referral || referral.status === "active") return;

  const now = new Date().toISOString();
  await supabase
    .from("referrals")
    .update({ status: "active", activated_at: now, last_seen_at: now })
    .eq("referred_id", referredId);

  await notify(supabase, referral.referrer_id, "referral_activated", {
    sourceId: referredId,
  });

  await checkAndApplyMilestoneReward(referral.referrer_id);
  await recalculateMonthlyBonus(referral.referrer_id);
}

// Mark a referral inactive (no login in 30 days).
export async function deactivateReferral(referredId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: referral } = await supabase
    .from("referrals")
    .select("referrer_id, status")
    .eq("referred_id", referredId)
    .maybeSingle();

  if (!referral || referral.status === "inactive") return;

  await supabase
    .from("referrals")
    .update({ status: "inactive" })
    .eq("referred_id", referredId);

  await notify(supabase, referral.referrer_id, "referral_inactive", {
    sourceId: referredId,
  });

  await recalculateMonthlyBonus(referral.referrer_id);
}

// Mark a referral churned (subscription cancelled).
export async function churnReferral(referredId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: referral } = await supabase
    .from("referrals")
    .select("referrer_id, status")
    .eq("referred_id", referredId)
    .maybeSingle();

  if (!referral || referral.status === "churned") return;

  await supabase
    .from("referrals")
    .update({ status: "churned" })
    .eq("referred_id", referredId);

  await notify(supabase, referral.referrer_id, "referral_churned", {
    sourceId: referredId,
  });

  await recalculateMonthlyBonus(referral.referrer_id);
}

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

export async function getActiveReferralCount(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", userId)
    .eq("status", "active");
  return count || 0;
}

// Total non-churned referrals — the cumulative count milestones are based on.
export async function getTotalReferralCount(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", userId)
    .neq("status", "churned");
  return count || 0;
}

// ---------------------------------------------------------------------------
// Activity gates
// ---------------------------------------------------------------------------

export async function checkActivityGates(userId: string): Promise<{
  profileComplete: boolean;
  returnedThreeDays: boolean;
  engagedWithPulse: boolean;
  allComplete: boolean;
}> {
  const supabase = createAdminClient();

  // Gate 1: profile complete (stage + skills + a bio/what-they're-building).
  const { data: profile } = await supabase
    .from("profiles")
    .select("stage, bio, what_they_are_building, skills")
    .eq("id", userId)
    .single();

  const hasBio = !!(profile?.bio || profile?.what_they_are_building);
  const profileComplete = !!(
    profile?.stage &&
    hasBio &&
    Array.isArray(profile?.skills) &&
    profile.skills.length > 0
  );

  // Gate 2: returned on 3 separate days.
  const { count: loginCount } = await supabase
    .from("login_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  const returnedThreeDays = (loginCount || 0) >= 3;

  // Gate 3: engaged with pulse (posted to pulse OR replied to anything).
  const { count: postCount } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("author_id", userId)
    .is("cohort_id", null); // pulse posts have no cohort_id

  const { count: replyCount } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("author_id", userId)
    .not("parent_post_id", "is", null); // replies have a parent

  const engagedWithPulse = (postCount || 0) + (replyCount || 0) > 0;

  return {
    profileComplete,
    returnedThreeDays,
    engagedWithPulse,
    allComplete: profileComplete && returnedThreeDays && engagedWithPulse,
  };
}

// Whether the referral link is live (gates complete AND not at the free cap).
export async function isReferralLinkActive(userId: string): Promise<{
  active: boolean;
  reason?: string;
  gatesComplete: boolean;
}> {
  const gates = await checkActivityGates(userId);
  if (!gates.allComplete) {
    return { active: false, reason: "Activity gates not complete", gatesComplete: false };
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .single();

  if (profile?.tier === "free") {
    const total = await getTotalReferralCount(userId);
    if (total >= 3) {
      return { active: false, reason: "Free tier referral cap reached", gatesComplete: true };
    }
  }

  return { active: true, gatesComplete: true };
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

type MilestoneType =
  | "milestone_1"
  | "milestone_3"
  | "milestone_5"
  | "milestone_10"
  | "milestone_25";

// Grant any milestone rewards the user has newly earned. Idempotent — each
// milestone is granted at most once (lifetime, never reset).
export async function checkAndApplyMilestoneReward(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const total = await getTotalReferralCount(userId);

  const milestones: { count: number; type: MilestoneType }[] = [
    { count: 1, type: "milestone_1" },
    { count: 3, type: "milestone_3" },
    { count: 5, type: "milestone_5" },
    { count: 10, type: "milestone_10" },
    { count: 25, type: "milestone_25" },
  ];

  for (const milestone of milestones) {
    if (total < milestone.count) continue;
    const { data: existing } = await supabase
      .from("referral_rewards")
      .select("id")
      .eq("user_id", userId)
      .eq("reward_type", milestone.type)
      .maybeSingle();
    if (!existing) {
      await applyMilestoneReward(userId, milestone.type, milestone.count);
    }
  }
}

// Value stamped into referral_rewards.stripe_coupon_id once a milestone has been
// applied to Stripe. One-off credits have no coupon, so they use a sentinel;
// recurring milestones record their actual coupon id.
const MILESTONE_APPLIED_MARKER: Record<MilestoneType, string> = {
  milestone_1: "credit_applied",
  milestone_3: "credit_applied",
  milestone_5: "credit_applied",
  milestone_10: "QUORUM_MILESTONE_10",
  milestone_25: "QUORUM_MILESTONE_25",
};

const REWARD_MESSAGES: Record<MilestoneType, string> = {
  milestone_1: "you earned $10 off your next month and the Connector badge!",
  milestone_3: "you earned 1 free month of Member!",
  milestone_5: "you earned 2 free months of Member!",
  milestone_10: "you earned 50% off Member for 6 months!",
  milestone_25: "you earned Member free for 1 full year!",
};

export async function applyMilestoneReward(
  userId: string,
  rewardType: MilestoneType,
  milestoneCount: number,
): Promise<void> {
  const supabase = createAdminClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  const rewardRecord: Record<string, unknown> = {
    user_id: userId,
    reward_type: rewardType,
    milestone_count: milestoneCount,
    applied_at: new Date().toISOString(),
    active: true,
  };

  // Time-limited milestones carry an expiry.
  if (rewardType === "milestone_10") {
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 6);
    rewardRecord.expires_at = expires.toISOString();
  }
  if (rewardType === "milestone_25") {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    rewardRecord.expires_at = expires.toISOString();
  }

  const { data: insertedReward } = await supabase
    .from("referral_rewards")
    .insert(rewardRecord)
    .select("id")
    .single();

  // Apply to Stripe — best-effort, never blocks the DB record. On success we
  // stamp stripe_coupon_id so the invoice.payment_succeeded webhook sweep can
  // tell applied rewards from genuinely-pending ones (and never re-credits a
  // one-off milestone). If the user has no subscription yet, the reward stays
  // pending and that same webhook applies it on their first paid invoice.
  if (subscription?.stripe_subscription_id) {
    try {
      await applyStripeReward(
        subscription.stripe_customer_id as string,
        subscription.stripe_subscription_id as string,
        rewardType,
      );
      if (insertedReward?.id) {
        await supabase
          .from("referral_rewards")
          .update({ stripe_coupon_id: MILESTONE_APPLIED_MARKER[rewardType] })
          .eq("id", insertedReward.id);
      }
    } catch (err) {
      console.error("Failed to apply Stripe reward:", err);
    }
  }

  // Connector badge for the first referral.
  if (rewardType === "milestone_1") {
    await supabase
      .from("profiles")
      .update({ connector_badge: true })
      .eq("id", userId);
  }

  await notify(supabase, userId, "referral_reward", {
    message: REWARD_MESSAGES[rewardType],
    payload: { reward_type: rewardType, milestone_count: milestoneCount },
  });
}

// Apply a milestone reward to Stripe (Session 9).
//  - milestones 1/3/5 → one-off customer balance credit (shows on next invoice)
//  - milestones 10/25 → recurring coupon attached to the subscription
// Throws on Stripe errors so callers can decide whether to mark the DB record as
// applied. Coupons must already exist (scripts/create-stripe-coupons.ts).
const MILESTONE_COUPON_IDS: Record<string, string> = {
  milestone_10: "QUORUM_MILESTONE_10",
  milestone_25: "QUORUM_MILESTONE_25",
};

const MILESTONE_CREDIT_CENTS: Record<string, number> = {
  milestone_1: 1000, // $10
  milestone_3: 4900, // $49 (1 free month)
  milestone_5: 9800, // $98 (2 free months)
};

export async function applyStripeReward(
  customerId: string,
  subscriptionId: string,
  rewardType: string,
): Promise<void> {
  // One-off rewards: apply as a negative customer balance transaction (credit).
  const creditAmount = MILESTONE_CREDIT_CENTS[rewardType];
  if (creditAmount) {
    await stripe.customers.createBalanceTransaction(customerId, {
      amount: -creditAmount, // negative = credit toward next invoice
      currency: "usd",
      description: `Quorum referral reward: ${rewardType}`,
    });
    console.log(
      `[Referral Reward] Applied $${creditAmount / 100} credit to customer ${customerId}`,
    );
    return;
  }

  // Recurring rewards: attach the coupon to the subscription (stacks with others).
  const couponId = MILESTONE_COUPON_IDS[rewardType];
  if (!couponId) {
    console.error(`No coupon mapped for reward type: ${rewardType}`);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(
    subscriptionId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expand: ["discounts"] } as any,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingDiscounts = ((subscription as any).discounts ?? []) as any[];

  const alreadyApplied = existingDiscounts.some((d) => d?.coupon?.id === couponId);
  if (alreadyApplied) {
    console.log(`[Referral Reward] ${couponId} already on subscription ${subscriptionId}`);
    return;
  }

  await stripe.subscriptions.update(subscriptionId, {
    discounts: [
      ...existingDiscounts.map((d) => ({ discount: d.id })),
      { coupon: couponId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any,
  });
  console.log(
    `[Referral Reward] Applied coupon ${couponId} to subscription ${subscriptionId}`,
  );
}

// Recalculate the monthly active-referral bonus (resets each billing cycle).
export async function recalculateMonthlyBonus(userId: string): Promise<void> {
  const supabase = createAdminClient();

  const activeCount = await getActiveReferralCount(userId);
  let discountAmount = 0;
  if (activeCount >= 5) discountAmount = 30;
  else if (activeCount >= 3) discountAmount = 20;
  else if (activeCount >= 1) discountAmount = 10;

  // Read the previous bonus so we only notify on an actual change.
  const { data: prev } = await supabase
    .from("referral_rewards")
    .select("id, milestone_count")
    .eq("user_id", userId)
    .eq("reward_type", "monthly_bonus")
    .eq("active", true)
    .maybeSingle();

  const prevCount = prev?.milestone_count ?? 0;
  const changed = prevCount !== activeCount;

  if (changed) {
    // Retire the old bonus, write a fresh one if still eligible.
    await supabase
      .from("referral_rewards")
      .update({ active: false })
      .eq("user_id", userId)
      .eq("reward_type", "monthly_bonus");

    if (discountAmount > 0) {
      await supabase.from("referral_rewards").insert({
        user_id: userId,
        reward_type: "monthly_bonus",
        milestone_count: activeCount,
        active: true,
      });
    }
  }

  // Always reconcile Stripe (idempotent — skips if the coupon already matches).
  // This also self-heals a subscription whose last update failed even when the
  // active count is unchanged. Never let a Stripe hiccup break the DB record.
  try {
    await applyMonthlyBonusToStripe(userId, activeCount);
  } catch (err) {
    console.error("[Monthly Bonus] Stripe update failed:", err);
  }

  if (changed) {
    await notify(supabase, userId, "monthly_bonus_updated", {
      payload: { active_count: activeCount, discount: discountAmount },
    });
  }
}

// ---------------------------------------------------------------------------
// Login tracking (powers the 3-day activity gate + referral last_seen_at)
// ---------------------------------------------------------------------------

export async function trackLoginEvent(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // One row per user per day (unique index handles dedup).
  await supabase
    .from("login_events")
    .upsert(
      { user_id: userId, date_key: today, logged_in_at: new Date().toISOString() },
      { onConflict: "user_id,date_key", ignoreDuplicates: true },
    );

  // Refresh last_seen_at on their referral record (if they were referred).
  await supabase
    .from("referrals")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("referred_id", userId)
    .neq("status", "churned");
}
