import { stripe } from "./stripe";
import { createAdminClient } from "@/lib/supabase/server";

// Monthly active-referral bonus → Stripe coupon wiring (Session 9).
//
// The bonus is recalculated each billing cycle and reflects how many of a
// referrer's referrals are currently `active`. It's applied as one of three
// repeating coupons, replaced (never accumulated) as the active count changes,
// and removed entirely when it drops to zero. It stacks alongside any milestone
// discounts already on the subscription — we only ever touch the bonus coupon.

const MONTHLY_BONUS_COUPONS: Record<number, string> = {
  10: "QUORUM_MONTHLY_10",
  20: "QUORUM_MONTHLY_20",
  30: "QUORUM_MONTHLY_30",
};

export const MONTHLY_BONUS_COUPON_IDS = Object.values(MONTHLY_BONUS_COUPONS);

// Map an active-referral count to its bonus coupon (null = no bonus earned).
function bonusCouponFor(activeReferralCount: number): string | null {
  if (activeReferralCount >= 5) return MONTHLY_BONUS_COUPONS[30];
  if (activeReferralCount >= 3) return MONTHLY_BONUS_COUPONS[20];
  if (activeReferralCount >= 1) return MONTHLY_BONUS_COUPONS[10];
  return null;
}

// Apply, replace, or remove the monthly bonus coupon on a user's subscription so
// it matches their current active-referral count. No-op when the user has no
// active subscription (the bonus is recorded in the DB and will be reconciled
// once they subscribe / on the next monthly recalculation).
export async function applyMonthlyBonusToStripe(
  userId: string,
  activeReferralCount: number,
): Promise<void> {
  const supabase = createAdminClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!subscription?.stripe_subscription_id) {
    console.log(`[Monthly Bonus] No subscription for user ${userId} — skipping`);
    return;
  }

  const newCouponId = bonusCouponFor(activeReferralCount);

  // Stripe's discounts param replaces the whole array, so retrieve current
  // discounts and preserve everything except the existing monthly bonus.
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.stripe_subscription_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expand: ["discounts"] } as any,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentDiscounts = ((stripeSubscription as any).discounts ?? []) as any[];

  const existingBonus = currentDiscounts.find((d) =>
    MONTHLY_BONUS_COUPON_IDS.includes(d?.coupon?.id),
  );

  // Same coupon already attached (or none needed and none present) → nothing to do.
  if ((existingBonus?.coupon?.id ?? null) === newCouponId) {
    return;
  }

  const nonBonusDiscounts = currentDiscounts
    .filter((d) => !MONTHLY_BONUS_COUPON_IDS.includes(d?.coupon?.id))
    .map((d) => ({ discount: d.id }));

  const discounts = newCouponId
    ? [...nonBonusDiscounts, { coupon: newCouponId }]
    : nonBonusDiscounts;

  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discounts: discounts as any,
  });

  if (newCouponId) {
    console.log(
      `[Monthly Bonus] Applied ${newCouponId} to user ${userId} (${activeReferralCount} active)`,
    );
  } else {
    console.log(`[Monthly Bonus] Removed monthly bonus for user ${userId} (0 active)`);
  }
}

// Remove any monthly bonus coupon from a user's subscription.
export async function removeMonthlyBonus(userId: string): Promise<void> {
  await applyMonthlyBonusToStripe(userId, 0);
}
