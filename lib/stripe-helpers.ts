import Stripe from "stripe";
import { stripe } from "./stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { TRIAL_DAYS } from "@/lib/pricing";

// Tier model: free / member / partner.
//
// IMPORTANT — `free` is a LAPSED state, not a membership. It means "trialed or
// subscribed once, isn't paying now": read-only, no cohort seat, no writes
// anywhere. It is deliberately not a tier anyone can sit in and participate
// from. A cohort seat is scarce and rivalrous — a non-paying member occupying
// one of twelve chairs degrades the room for the eleven who are paying, which
// is why there's no metered free rung. See lib/pricing.ts.
export type Tier = "free" | "member" | "partner";

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

// Check whether a user has hit a usage cap for a feature. Paid tiers are uncapped.
export async function checkUsageCap(
  userId: string,
  feature: UsageFeature,
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const supabase = createAdminClient();
  const tier = await getUserTier(userId);

  if (tier === "member" || tier === "partner") {
    return { allowed: true, current: 0, limit: -1 };
  }

  const limit = LAPSED_LIMITS[feature];

  // Every write is blocked once lapsed — there is no metered free rung.
  if (limit === 0) {
    return { allowed: false, current: 0, limit: 0 };
  }

  const month = getCurrentMonth();
  const { data } = await supabase
    .from("usage_tracking")
    .select(feature)
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();

  const current = ((data as Record<string, number> | null)?.[feature] as number) || 0;
  return { allowed: current < limit, current, limit };
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

  const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
  let tier: Tier = "free";
  if (priceId && priceId === process.env.STRIPE_MEMBER_PRICE_ID) tier = "member";
  if (priceId && priceId === process.env.STRIPE_PARTNER_PRICE_ID) tier = "partner";

  const status = stripeSubscription.status;
  // Only an active/trialing subscription grants paid access.
  const effectiveTier: Tier =
    status === "active" || status === "trialing" ? tier : "free";

  const sub = stripeSubscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };

  await supabase.from("subscriptions").upsert(
    {
      user_id: resolvedUserId,
      stripe_customer_id: stripeSubscription.customer as string,
      stripe_subscription_id: stripeSubscription.id,
      tier: effectiveTier,
      status,
      trial_ends_at: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000).toISOString()
        : null,
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
