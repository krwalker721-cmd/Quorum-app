import { stripe } from "./stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { BONUS_TIERS, tierFor } from "@/lib/referral-model";

// Standing referral bonus — a recurring discount sized by how many of your
// referrals are CURRENTLY active, recalculated every time that count moves.
//
// This is the model Quorum ran at $49, restored and re-scaled for $39. It was
// briefly replaced by a flat 50%-off (which capped effective revenue near half
// list price) and then by one-shot credit per activation. Both optimised for
// acquisition; this one pays for people who stay, which is what a cohort
// product actually needs — a referrer whose people go quiet loses the discount,
// so they have a reason to care whether the room is alive.
//
// The ladder extends past the old $30 ceiling on purpose: the old model
// dead-ended at 5 referrals, which is the wrong place to stop paying when a
// full cohort is 12 seats. Filling a room earns the room.

// Ladder and tier resolution live in lib/referral-model.ts so the onboarding
// pitch and the billing logic read from the same numbers.
export const BONUS_COUPON_IDS = Array.from(new Set(BONUS_TIERS.map((t) => t.coupon)));

/**
 * Reconcile the standing bonus coupon on a member's subscription against their
 * current active-referral count. Exactly one bonus coupon is ever attached —
 * it's replaced, never accumulated — and removed entirely at zero.
 *
 * Never throws: a Stripe hiccup must not break the DB record or fail a webhook.
 * Safe to re-run; it no-ops when the right coupon is already attached.
 */
export async function applyBonusToStripe(
  userId: string,
  activeCount: number,
): Promise<void> {
  const supabase = createAdminClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  // No subscription yet — the DB row stands and this reconciles on their first
  // paid invoice.
  if (!subscription?.stripe_subscription_id) return;

  const wanted = tierFor(activeCount)?.coupon ?? null;

  const stripeSub = await stripe.subscriptions.retrieve(
    subscription.stripe_subscription_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expand: ["discounts"] } as any,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = ((stripeSub as any).discounts ?? []) as any[];
  const existing = current.find((d) => BONUS_COUPON_IDS.includes(d?.coupon?.id));

  // Already correct (right coupon attached, or none wanted and none present).
  if ((existing?.coupon?.id ?? null) === wanted) return;

  // Stripe's discounts param replaces the whole array, so carry over every
  // non-bonus discount and swap only ours.
  const keep = current
    .filter((d) => !BONUS_COUPON_IDS.includes(d?.coupon?.id))
    .map((d) => ({ discount: d.id }));

  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    discounts: wanted ? [...keep, { coupon: wanted }] : keep,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}
