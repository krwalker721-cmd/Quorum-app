import { stripe } from "../lib/stripe";
import { createAdminClient } from "../lib/supabase/server";

// One-shot migration: detach the retired QUORUM_MONTHLY_50 coupon from every
// subscription still carrying it.
//
// That coupon was the old referral reward — a permanent 50% off earned from a
// single referral. It's been replaced by per-referral credit (see
// lib/referral-credit.ts). Left attached, it would silently halve the new
// price for every early member forever.
//
// Safe to re-run: subscriptions without the coupon are skipped. Migration 013
// has already deactivated the matching referral_rewards rows.

const RETIRED_COUPON = "QUORUM_MONTHLY_50";

async function main() {
  const supabase = createAdminClient();

  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("user_id, stripe_subscription_id")
    .not("stripe_subscription_id", "is", null);

  if (error) throw error;

  let detached = 0;
  let skipped = 0;

  for (const sub of subs ?? []) {
    const id = sub.stripe_subscription_id as string;
    try {
      const stripeSub = await stripe.subscriptions.retrieve(id, {
        expand: ["discounts"],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const discounts = ((stripeSub as any).discounts ?? []) as any[];
      if (!discounts.some((d) => d?.coupon?.id === RETIRED_COUPON)) {
        skipped++;
        continue;
      }

      const keep = discounts
        .filter((d) => d?.coupon?.id !== RETIRED_COUPON)
        .map((d) => ({ discount: d.id }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await stripe.subscriptions.update(id, { discounts: keep as any });
      detached++;
      console.log(`✓ Detached ${RETIRED_COUPON} from ${id} (user ${sub.user_id})`);
    } catch (err) {
      console.error(`✗ Failed on ${id}:`, err);
    }
  }

  console.log(`\nDone. Detached: ${detached}. Already clean: ${skipped}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
