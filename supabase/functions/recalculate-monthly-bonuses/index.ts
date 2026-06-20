// Scheduled monthly (recommended: 0 0 1 * * — midnight UTC on the 1st).
// Recalculates every referrer's monthly active-referral bonus and reconciles the
// matching repeating coupon on their Stripe subscription. Mirrors
// lib/monthly-bonus-stripe.ts so the app and the cron agree on coupon state.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const MONTHLY_BONUS_COUPON_IDS = [
  "QUORUM_MONTHLY_10",
  "QUORUM_MONTHLY_20",
  "QUORUM_MONTHLY_30",
];

function bonusCouponFor(active: number): string | null {
  if (active >= 5) return "QUORUM_MONTHLY_30";
  if (active >= 3) return "QUORUM_MONTHLY_20";
  if (active >= 1) return "QUORUM_MONTHLY_10";
  return null;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-06-20",
  });

  // Everyone with at least one non-churned referral.
  const { data: referrers } = await supabase
    .from("referrals")
    .select("referrer_id")
    .neq("status", "churned");

  if (!referrers?.length) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const uniqueReferrerIds = [...new Set(referrers.map((r) => r.referrer_id))];
  let processed = 0;

  for (const userId of uniqueReferrerIds) {
    const { count } = await supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", userId)
      .eq("status", "active");
    const active = count || 0;

    // Detect whether the bonus actually changed (drives the notification).
    const { data: prev } = await supabase
      .from("referral_rewards")
      .select("milestone_count")
      .eq("user_id", userId)
      .eq("reward_type", "monthly_bonus")
      .eq("active", true)
      .maybeSingle();
    const changed = (prev?.milestone_count ?? 0) !== active;

    if (changed) {
      await supabase
        .from("referral_rewards")
        .update({ active: false })
        .eq("user_id", userId)
        .eq("reward_type", "monthly_bonus");

      if (active > 0) {
        await supabase.from("referral_rewards").insert({
          user_id: userId,
          reward_type: "monthly_bonus",
          milestone_count: active,
          active: true,
        });
      }
    }

    // Reconcile the Stripe subscription's bonus coupon.
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (subscription?.stripe_subscription_id) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id,
          // deno-lint-ignore no-explicit-any
          { expand: ["discounts"] } as any,
        );
        // deno-lint-ignore no-explicit-any
        const currentDiscounts = ((stripeSub as any).discounts ?? []) as any[];
        const existingBonus = currentDiscounts.find((d) =>
          MONTHLY_BONUS_COUPON_IDS.includes(d?.coupon?.id),
        );
        const newCouponId = bonusCouponFor(active);

        if ((existingBonus?.coupon?.id ?? null) !== newCouponId) {
          const nonBonusDiscounts = currentDiscounts
            .filter((d) => !MONTHLY_BONUS_COUPON_IDS.includes(d?.coupon?.id))
            .map((d) => ({ discount: d.id }));
          const newDiscounts = newCouponId
            ? [...nonBonusDiscounts, { coupon: newCouponId }]
            : nonBonusDiscounts;
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            // deno-lint-ignore no-explicit-any
            discounts: newDiscounts as any,
          });
        }
      } catch (err) {
        console.error(`Failed to update Stripe for user ${userId}:`, err);
      }
    }

    // Notify only when the bonus changed. notifications has NOT NULL kind +
    // message, so always supply both alongside the newer columns.
    if (changed) {
      await supabase.from("notifications").insert({
        user_id: userId,
        kind: "monthly_bonus_updated",
        type: "monthly_bonus_updated",
        message: "your monthly referral bonus has been updated",
        source_type: "system",
        read: false,
      });
    }

    processed++;
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { "Content-Type": "application/json" },
  });
});
