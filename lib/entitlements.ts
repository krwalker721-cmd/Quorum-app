import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

// Entitlement — the single source of truth for "what is this account allowed to
// do right now".
//
// Before this existed the answer was assembled ad hoc in four places that
// disagreed with each other, which produced two user-visible lies:
//
//  1. A trialing account. `subscriptions.status` is "trialing" but
//     `profiles.tier` is "free" (the trial is granted without a card, so there
//     is no paid tier to stamp). Every client check honoured the trial; the
//     server-side cap check only looked at the tier, so the banner said "trial
//     active — full member access" while every write 403'd.
//  2. A paying member. Tier was derived from a two-entry price-id map, so a
//     founding or annual subscription — both real, both charged — resolved to
//     "free". Same outcome if a webhook was simply missed.
//
// So: one resolver, and it is allowed to check with Stripe when the local answer
// is "no". A subscription that Stripe says is live must never be blocked by
// stale Supabase state.

export type Tier = "free" | "member" | "partner";

/** Why the account has access — drives copy, not permissions. */
export type AccessReason = "paid" | "trial" | "none";

export interface Entitlement {
  /** Paid tier. "free" during a card-free trial — check `hasFullAccess`. */
  tier: Tier;
  /** Raw Stripe subscription status, or "trialing" for a card-free trial. */
  status: string;
  trialEndsAt: string | null;
  /** Whole days remaining, floored at 0. Null when there is no trial. */
  daysLeftInTrial: number | null;
  /** The trial window is open right now. */
  isTrialing: boolean;
  /** A trial existed and has already run out. */
  hadTrial: boolean;
  /** THE permission bit. Paid or trialing — every feature is open. */
  hasFullAccess: boolean;
  accessReason: AccessReason;
  /** Stripe is retrying a failed payment. Access continues through the grace. */
  paymentFailing: boolean;
  hasStripeSubscription: boolean;
  stripeCustomerId: string | null;
  subscriptionCreatedAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  referredFreeMonthExpiresAt: string | null;
  partnerWaitlist: boolean;
}

// Statuses that grant access. `past_due` is deliberately included: Stripe is
// still retrying the card, and lib/lapse.ts already runs a grace window with
// escalating banners before the cohort seat goes back to the pool. Hard-blocking
// a member the instant one retry fails would be the same class of bug as the two
// above. `unpaid` and `canceled` are not here — those are Stripe giving up.
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * Map a Stripe price id to the tier it grants. Reads env on every call so a
 * price id added to the environment takes effect without a rebuild.
 */
export function tierForPriceId(priceId: string | null | undefined): Tier | null {
  if (!priceId) return null;

  // Every Member-equivalent price. Founding and annual are the same product at
  // a different rate — the whole original bug was that these two were missing.
  const memberPrices = [
    process.env.STRIPE_MEMBER_PRICE_ID,
    process.env.STRIPE_MEMBER_ANNUAL_PRICE_ID,
    process.env.STRIPE_FOUNDING_PRICE_ID,
  ].filter(Boolean);

  if (memberPrices.includes(priceId)) return "member";
  if (priceId && priceId === process.env.STRIPE_PARTNER_PRICE_ID) return "partner";
  return null;
}

/** Map the `plan` key we stamp into subscription metadata at checkout. */
function tierForPlanKey(plan: string | null | undefined): Tier | null {
  if (!plan) return null;
  if (plan === "partner") return "partner";
  if (plan === "member" || plan === "member_annual" || plan === "founding") {
    return "member";
  }
  return null;
}

/**
 * Resolve the tier a live Stripe subscription grants.
 *
 * Three sources, most to least reliable: the `plan` key we stamped into
 * metadata at checkout, the price-id map, then a floor. The floor matters — if a
 * price is created in the Stripe dashboard and never added to the environment,
 * an account that is genuinely being charged resolves to Member rather than to
 * "free". Under-serving a paying customer is a bug; over-serving one by a tier
 * is a support ticket.
 */
export function tierForSubscription(subscription: Stripe.Subscription): Tier {
  const status = subscription.status;
  if (!ENTITLED_STATUSES.has(status)) return "free";

  const fromPlan = tierForPlanKey(subscription.metadata?.plan);
  if (fromPlan) return fromPlan;

  const priceId = subscription.items?.data?.[0]?.price?.id;
  const fromPrice = tierForPriceId(priceId);
  if (fromPrice) return fromPrice;

  console.warn(
    `[entitlements] unrecognized price ${priceId} on live subscription ` +
      `${subscription.id} — granting member so a paying account isn't blocked`,
  );
  return "member";
}

/** Whole days from now until `iso`, floored at 0. */
function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 ? Math.ceil(diff / 86_400_000) : 0;
}

export interface SubscriptionRow {
  tier: string | null;
  status: string | null;
  trial_ends_at: string | null;
  created_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  referred_free_month_expires_at: string | null;
}

export interface ProfileRow {
  tier: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  partner_waitlist: boolean | null;
}

/** Pure projection of stored state onto an Entitlement. No I/O, so it's directly
 *  testable — every access decision in the app comes out of this function. */
export function computeEntitlement(
  sub: SubscriptionRow | null,
  profile: ProfileRow | null,
): Entitlement {
  const status = sub?.status || "trialing";
  const statusEntitled = ENTITLED_STATUSES.has(status);

  // Both tables carry a tier and they can disagree — lib/lapse.ts writes
  // profiles.tier without touching subscriptions.tier. Take the better of the
  // two, but only while the status actually grants access, so a canceled row
  // with a stale tier="member" can't keep paying for itself.
  const storedTiers = [sub?.tier, profile?.tier].filter(
    (t): t is Tier => t === "member" || t === "partner",
  );
  let paidTier: Tier = "free";
  if (statusEntitled && storedTiers.length > 0) {
    paidTier = storedTiers.includes("partner") ? "partner" : "member";
  }

  // The trial clock lives on either row; profiles is stamped by onboarding.
  const trialEndsAt = profile?.trial_ends_at || sub?.trial_ends_at || null;
  const trialOpen = trialEndsAt ? new Date(trialEndsAt).getTime() > Date.now() : false;

  // A trial only grants access while its status says trialing AND the window is
  // open. This is what makes an expired trial lapse the moment it expires,
  // without waiting on the expire-trials cron to flip the status.
  const isTrialing = status === "trialing" && trialOpen;
  const hadTrial = !!trialEndsAt && !trialOpen;

  const hasFullAccess = paidTier !== "free" || isTrialing;

  return {
    tier: paidTier,
    status,
    trialEndsAt,
    daysLeftInTrial: trialEndsAt ? daysUntil(trialEndsAt) : null,
    isTrialing,
    hadTrial,
    hasFullAccess,
    accessReason: paidTier !== "free" ? "paid" : isTrialing ? "trial" : "none",
    paymentFailing: status === "past_due",
    hasStripeSubscription: !!sub?.stripe_subscription_id,
    stripeCustomerId: sub?.stripe_customer_id || profile?.stripe_customer_id || null,
    subscriptionCreatedAt: sub?.created_at || null,
    currentPeriodEnd: sub?.current_period_end || null,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
    referredFreeMonthExpiresAt: sub?.referred_free_month_expires_at || null,
    partnerWaitlist: !!profile?.partner_waitlist,
  };
}

const SUBSCRIPTION_COLUMNS =
  "tier, status, trial_ends_at, created_at, current_period_end, " +
  "cancel_at_period_end, stripe_customer_id, stripe_subscription_id, " +
  "referred_free_month_expires_at";

async function readStoredState(userId: string) {
  const supabase = createAdminClient();

  const [{ data: sub }, { data: profile }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(SUBSCRIPTION_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("tier, trial_ends_at, stripe_customer_id, partner_waitlist")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  return {
    sub: (sub as SubscriptionRow | null) ?? null,
    profile: (profile as ProfileRow | null) ?? null,
  };
}

// Reconciliation throttle. Without it, every page load by a genuinely lapsed
// account would hit the Stripe API, since "looks unentitled" is exactly the
// trigger. Per-process and therefore best-effort — the failure mode is a few
// redundant reads after a cold start, never a wrong answer.
const RECONCILE_WINDOW_MS = 60_000;
const lastReconciledAt = new Map<string, number>();

function throttled(userId: string): boolean {
  const last = lastReconciledAt.get(userId);
  return last !== undefined && Date.now() - last < RECONCILE_WINDOW_MS;
}

/** Rank of a subscription's claim to be the one that counts. */
function statusRank(status: string): number {
  if (status === "active") return 3;
  if (status === "trialing") return 2;
  if (status === "past_due") return 1;
  return 0;
}

/**
 * Find this user's Stripe customer when no customer id is stored locally.
 *
 * getOrCreateStripeCustomer stamps `metadata.supabase_user_id` on every customer
 * it creates, so the link always exists on Stripe's side even if the write that
 * saved the id back to Supabase was lost. Without this fallback the self-heal
 * can't start: it needs a customer id to ask about, and the one case that most
 * needs healing is the one where local state is missing.
 */
async function findStripeCustomerByUserId(userId: string): Promise<string | null> {
  try {
    const res = await stripe.customers.search({
      query: `metadata['supabase_user_id']:'${userId}'`,
      limit: 1,
    });
    return res.data[0]?.id ?? null;
  } catch (err) {
    // Search is index-backed and lags object creation by up to a minute, and is
    // unavailable on some accounts. Either way this is a fallback, not a
    // dependency — a failure just means no heal on this pass.
    console.error("[entitlements] customer search failed:", err);
    return null;
  }
}

/**
 * Pull live state from Stripe and write it back to Supabase. This is the
 * self-heal: a missed webhook, a price id that wasn't in the env map, or a
 * checkout that completed after the page rendered all resolve here.
 *
 * Returns true if anything was written. Only ever writes when Stripe has a live
 * subscription — with no live subscription it leaves local state alone, because
 * a card-free trial is real access that exists nowhere in Stripe and must not be
 * overwritten with "free".
 */
export async function reconcileEntitlementFromStripe(
  userId: string,
  opts: { force?: boolean; allowSearch?: boolean } = {},
): Promise<boolean> {
  if (!opts.force && throttled(userId)) return false;
  lastReconciledAt.set(userId, Date.now());

  const { sub, profile } = await readStoredState(userId);
  let customerId = sub?.stripe_customer_id || profile?.stripe_customer_id || null;

  // The search costs a Stripe round trip, so it's opt-in: on for the paths where
  // a wrong answer blocks a paying member (a denied write, the post-checkout
  // sync), off for the ones that run on every page render.
  if (!customerId && (opts.allowSearch || opts.force)) {
    customerId = await findStripeCustomerByUserId(userId);
    if (!customerId) return false;
    // Persist the recovered link so the next pass doesn't need the search.
    await createAdminClient()
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
  }

  // No customer to ask about (and the search was either off or found nothing).
  if (!customerId) return false;

  try {
    const { data: subscriptions } = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });

    const live = subscriptions
      .filter((s) => ENTITLED_STATUSES.has(s.status))
      .sort((a, b) => statusRank(b.status) - statusRank(a.status))[0];

    if (!live) return false;

    // Imported lazily: stripe-helpers imports this module for tier resolution,
    // so a top-level import would close the cycle.
    const { syncSubscriptionToSupabase } = await import("@/lib/stripe-helpers");
    await syncSubscriptionToSupabase(live, userId);
    return true;
  } catch (err) {
    console.error("[entitlements] Stripe reconcile failed:", err);
    return false;
  }
}

export interface ResolveOptions {
  /**
   * Check Stripe when the stored state grants no access. Use on any path where
   * being wrong means blocking or nagging a paying member. Throttled per user.
   */
  reconcileIfBlocked?: boolean;
  /**
   * Also search Stripe for the customer when no customer id is stored locally.
   * Adds a round trip, so reserve it for paths that run on an action (a denied
   * write) rather than on every page render.
   */
  deepSearch?: boolean;
}

/**
 * Resolve what an account may do. Reads stored state, and when that state says
 * "no access" while a Stripe customer exists, verifies against Stripe before
 * accepting the answer.
 */
export async function resolveEntitlement(
  userId: string,
  opts: ResolveOptions = {},
): Promise<Entitlement> {
  const { sub, profile } = await readStoredState(userId);
  const entitlement = computeEntitlement(sub, profile);

  if (entitlement.hasFullAccess || !opts.reconcileIfBlocked) return entitlement;
  // Without a stored customer id there is nothing to ask Stripe about unless the
  // caller opted into the search.
  if (!entitlement.stripeCustomerId && !opts.deepSearch) return entitlement;

  const healed = await reconcileEntitlementFromStripe(userId, {
    allowSearch: opts.deepSearch,
  });
  if (!healed) return entitlement;

  const fresh = await readStoredState(userId);
  return computeEntitlement(fresh.sub, fresh.profile);
}
