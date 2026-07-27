import { stripe } from "./stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { PRICING, REFERRAL_CREDIT_MONTHS_PER_ACTIVATION } from "@/lib/pricing";

// Referral credit — one month of Member per referral who activates and stays.
//
// This replaces the old standing "50% off forever from a single referral"
// coupon. That model quietly capped effective revenue at half list price,
// because in a product that grows by referral the steady state is that most
// members have referred at least one person. Credit is granted per founder
// actually delivered instead, so the reward scales with contribution and can't
// produce a permanent half-price rider off one invite.
//
// Implemented as Stripe customer balance credit rather than a coupon: balance
// is consumed by future invoices automatically, carries over cleanly across
// billing cycles, and stacks without any of the coupon-replacement juggling the
// old monthly-bonus wiring needed.

/** Credit granted per activated referral, in cents. */
export const CREDIT_PER_ACTIVATION_CENTS =
  PRICING.member.monthly * 100 * REFERRAL_CREDIT_MONTHS_PER_ACTIVATION;

/**
 * Grant referral credit for one activated referral. Idempotent per referral:
 * `referral_rewards` carries a unique row keyed by the referred user, so a
 * replayed webhook or a re-run activation can never double-credit.
 *
 * Deliberately not clawed back if the referred founder later churns — they were
 * genuinely delivered, and the activity gates in checkActivityGates() are what
 * stop drive-by signups from earning anything in the first place.
 */
export async function grantReferralCredit(
  referrerId: string,
  referredId: string,
): Promise<void> {
  const supabase = createAdminClient();

  // Idempotency guard — has this specific referral already paid out?
  const { data: existing } = await supabase
    .from("referral_rewards")
    .select("id")
    .eq("user_id", referrerId)
    .eq("reward_type", "referral_credit")
    .eq("source_referred_id", referredId)
    .maybeSingle();

  if (existing) return;

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", referrerId)
    .maybeSingle();

  // Record the entitlement first, so a Stripe outage can't lose it. If the
  // customer doesn't exist yet (referrer never added a card), the row still
  // stands and reconcilePendingCredit() applies it once they do.
  const { error: insertErr } = await supabase.from("referral_rewards").insert({
    user_id: referrerId,
    reward_type: "referral_credit",
    source_referred_id: referredId,
    milestone_count: REFERRAL_CREDIT_MONTHS_PER_ACTIVATION,
    amount_cents: CREDIT_PER_ACTIVATION_CENTS,
    applied: false,
    active: true,
  });

  // A unique-violation means a concurrent call already claimed this referral.
  if (insertErr) {
    if (insertErr.code === "23505") return;
    throw insertErr;
  }

  if (!subscription?.stripe_customer_id) {
    console.log(
      `[Referral Credit] No Stripe customer for ${referrerId} — credit recorded, pending`,
    );
    return;
  }

  await applyCreditToStripe(
    referrerId,
    subscription.stripe_customer_id,
    CREDIT_PER_ACTIVATION_CENTS,
    referredId,
  );
}

/** Push one credit grant to Stripe and mark it applied. */
async function applyCreditToStripe(
  referrerId: string,
  customerId: string,
  amountCents: number,
  referredId: string,
): Promise<void> {
  const supabase = createAdminClient();
  try {
    // Negative amount credits the customer; Stripe draws it down automatically
    // on subsequent invoices.
    await stripe.customers.createBalanceTransaction(customerId, {
      amount: -amountCents,
      currency: "usd",
      description: `Quorum referral credit — ${REFERRAL_CREDIT_MONTHS_PER_ACTIVATION} month of Member`,
      metadata: { referrer_id: referrerId, referred_id: referredId },
    });

    await supabase
      .from("referral_rewards")
      .update({ applied: true, applied_at: new Date().toISOString() })
      .eq("user_id", referrerId)
      .eq("reward_type", "referral_credit")
      .eq("source_referred_id", referredId);
  } catch (err) {
    // Left unapplied on purpose — reconcilePendingCredit() retries it later.
    console.error("[Referral Credit] Stripe grant failed:", err);
  }
}

/**
 * Apply any credit that was earned before the member had a Stripe customer (or
 * whose grant failed). Called when a card is saved and on subscription events.
 */
export async function reconcilePendingCredit(userId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: pending } = await supabase
    .from("referral_rewards")
    .select("source_referred_id, amount_cents")
    .eq("user_id", userId)
    .eq("reward_type", "referral_credit")
    .eq("applied", false);

  if (!pending || pending.length === 0) return;

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) return;

  for (const row of pending) {
    await applyCreditToStripe(
      userId,
      subscription.stripe_customer_id,
      row.amount_cents ?? CREDIT_PER_ACTIVATION_CENTS,
      row.source_referred_id as string,
    );
  }
}

/** Total credit a member has earned, in months — for the referrals dashboard. */
export async function getEarnedCreditMonths(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("referral_rewards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("reward_type", "referral_credit");
  return (count || 0) * REFERRAL_CREDIT_MONTHS_PER_ACTIVATION;
}
