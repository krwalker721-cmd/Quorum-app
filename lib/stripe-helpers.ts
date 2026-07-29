import Stripe from "stripe";
import { stripe } from "./stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { TRIAL_DAYS } from "@/lib/pricing";
import {
  resolveEntitlement,
  tierForSubscription,
  type Tier,
} from "@/lib/entitlements";

// Tier model: free / member / partner.
//
// IMPORTANT — `free` is a LAPSED state, not a membership. It means "trialed or
// subscribed once, isn't paying now": read-only, no cohort seat, no writes
// anywhere. It is deliberately not a tier anyone can sit in and participate
// from. A cohort seat is scarce and rivalrous — a non-paying member occupying
// one of twelve chairs degrades the room for the eleven who are paying, which
// is why there's no metered free rung. See lib/pricing.ts.
//
// A card-free TRIAL is not this state. It stores tier="free" (there's no paid
// tier to stamp) with status="trialing", and it grants everything. Never decide
// access from a tier string alone — ask lib/entitlements.ts.
export type { Tier };

// Lapsed accounts can read, and write nothing. Kept as a map (rather than a
// blanket deny) so the usage plumbing, paywall copy, and admin tooling all keep
// working unchanged.
const LAPSED_LIMITS = {
  cohort_posts: 0,
  pulse_posts: 0,
  replies: 0,
  messages: 0,
  vault_notes: 0,
  collab_posts: 0,
} as const;

export type UsageFeature = keyof typeof LAPSED_LIMITS;

// Get or create a Stripe customer for a user. Uses the service-role client so it
// can persist the customer id regardless of the calling request's auth context.
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string | null,
): Promise<string> {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: { supabase_user_id: userId },
  });

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customer.id,
      tier: "free",
      status: "trialing",
    },
    { onConflict: "user_id" },
  );

  return customer.id;
}

// Current user tier from profiles.
export async function getUserTier(userId: string): Promise<Tier> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .single();
  return (data?.tier as Tier) || "free";
}

// Current month string in YYYY-MM format.
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Authoritative write gate, enforced by every write route.
 *
 * This used to read `profiles.tier` and nothing else, which meant a trialing
 * account (tier "free", status "trialing") was blocked from every write while
 * being told its trial was active. It now asks lib/entitlements.ts, which knows
 * that a live trial and a paid subscription both grant everything — and which
 * double-checks Stripe before blocking, so a paying member is never turned away
 * on the strength of stale local state.
 *
 * `reason` distinguishes the two ways to be denied, so callers can say "upgrade
 * your plan" rather than inventing a usage limit that doesn't exist.
 */
export async function checkUsageCap(
  userId: string,
  feature: UsageFeature,
): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  reason: "entitled" | "upgrade_required";
}> {
  // deepSearch: a denied write is exactly the moment worth spending a Stripe
  // round trip on, and it runs on an action rather than on every page render.
  const entitlement = await resolveEntitlement(userId, {
    reconcileIfBlocked: true,
    deepSearch: true,
  });

  if (entitlement.hasFullAccess) {
    return { allowed: true, current: 0, limit: -1, reason: "entitled" };
  }

  // No live trial and nothing paid: every write is closed. There is no metered
  // free rung to be partway through, so there is no usage to report.
  return { allowed: false, current: 0, limit: LAPSED_LIMITS[feature], reason: "upgrade_required" };
}

// Increment a usage counter for the current month (upsert).
export async function incrementUsage(
  userId: string,
  feature: UsageFeature,
): Promise<void> {
  const supabase = createAdminClient();
  const month = getCurrentMonth();

  const { data: existing } = await supabase
    .from("usage_tracking")
    .select(`id, ${feature}`)
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();

  if (existing) {
    const current = ((existing as Record<string, number>)[feature] as number) || 0;
    await supabase
      .from("usage_tracking")
      .update({ [feature]: current + 1 })
      .eq("id", (existing as { id: string }).id);
  } else {
    await supabase
      .from("usage_tracking")
      .insert({ user_id: userId, month, [feature]: 1 });
  }
}

// Sync a Stripe subscription object into Supabase (subscriptions + profiles.tier).
export async function syncSubscriptionToSupabase(
  stripeSubscription: Stripe.Subscription,
  userId?: string,
): Promise<void> {
  const supabase = createAdminClient();

  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const customer = await stripe.customers.retrieve(
      stripeSubscription.customer as string,
    );
    if ("deleted" in customer) return;
    resolvedUserId = customer.metadata?.supabase_user_id;
  }
  if (!resolvedUserId) return;

  // Tier resolution lives in lib/entitlements.ts, which maps every paid price
  // (member, member_annual, founding, partner) and falls back to Member for an
  // unrecognized price on a live subscription. The old two-entry map here left
  // anyone on the founding or annual rate stranded on "free" while Stripe
  // charged them.
  const effectiveTier: Tier = tierForSubscription(stripeSubscription);
  const status = stripeSubscription.status;

  const sub = stripeSubscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };

  const stripeTrialEnd = stripeSubscription.trial_end
    ? new Date(stripeSubscription.trial_end * 1000).toISOString()
    : null;

  // Preserve a trial date Stripe doesn't know about. Upgrading mid-trial creates
  // a subscription with no Stripe trial, and blanking the date here would erase
  // the record that this account ever trialed — which `hadTrial` copy depends on.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("trial_ends_at")
    .eq("user_id", resolvedUserId)
    .maybeSingle();

  await supabase.from("subscriptions").upsert(
    {
      user_id: resolvedUserId,
      stripe_customer_id: stripeSubscription.customer as string,
      stripe_subscription_id: stripeSubscription.id,
      tier: effectiveTier,
      status,
      trial_ends_at: stripeTrialEnd ?? existing?.trial_ends_at ?? null,
      current_period_start: sub.current_period_start
        ? new Date(sub.current_period_start * 1000).toISOString()
        : null,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    },
    { onConflict: "user_id" },
  );

  await supabase
    .from("profiles")
    .update({ tier: effectiveTier })
    .eq("id", resolvedUserId);
}

// Initialize a subscription record when a user is approved / starts their trial.
// Everyone gets a trial long enough to live through several weekly check-in
// cycles; referred founders get a longer one as the invitee half of the referral
// incentive. Referred users also get a 48-hour window to add a card for a free
// first month.
export async function initializeUserSubscription(
  userId: string,
  isReferred: boolean = false,
): Promise<void> {
  const supabase = createAdminClient();

  const trialDays = isReferred ? TRIAL_DAYS.referred : TRIAL_DAYS.standard;
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

  const referredFreeMonthExpiresAt = isReferred
    ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    : null;

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      tier: "free",
      status: "trialing",
      trial_ends_at: trialEndsAt.toISOString(),
      referred_free_month_expires_at: referredFreeMonthExpiresAt,
    },
    { onConflict: "user_id" },
  );

  await supabase
    .from("profiles")
    .update({ tier: "free", trial_ends_at: trialEndsAt.toISOString() })
    .eq("id", userId);
}
