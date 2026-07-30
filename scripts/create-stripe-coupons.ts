// One-time setup: creates (or verifies) all referral-reward coupons in Stripe.
// Run once per Stripe account/mode (test vs live):
//   npx ts-node --project tsconfig.json scripts/create-stripe-coupons.ts
//
// Coupons use predictable, reusable IDs so the app can attach them by id without
// storing a per-user coupon. Re-running is safe — existing coupons are skipped.
import { stripe } from "../lib/stripe";

// Local shape for the coupon definitions. Kept independent of Stripe's exported
// param namespace so this one-off script compiles under any module resolver.
interface CouponDef {
  id: string;
  name: string;
  duration: "once" | "repeating";
  currency?: string;
  amount_off?: number;
  percent_off?: number;
  duration_in_months?: number;
}

const coupons: CouponDef[] = [
  // NOTE: the QUORUM_MILESTONE_* coupons are gone. Milestones are badges now
  // (see applyMilestoneReward in lib/referral-helpers.ts) and never touch
  // Stripe — paying free months there on top of the standing bonus would credit
  // the same referral twice.

  // ── Standing referral bonus (repeating; swapped as the active count moves) ──
  // Sized against the $39 Member price. See lib/referral-bonus.ts for the
  // ladder — these ids must stay in sync with BONUS_TIERS.
  {
    id: "QUORUM_MONTHLY_10",
    amount_off: 1000,
    currency: "usd",
    duration: "repeating",
    duration_in_months: 120, // effectively permanent; removed when unearned
    name: "Quorum Referral Bonus - $10 Off",
  },
  {
    id: "QUORUM_MONTHLY_20",
    amount_off: 2000,
    currency: "usd",
    duration: "repeating",
    duration_in_months: 120,
    name: "Quorum Referral Bonus - $20 Off",
  },
  {
    id: "QUORUM_MONTHLY_30",
    amount_off: 3000,
    currency: "usd",
    duration: "repeating",
    duration_in_months: 120,
    name: "Quorum Referral Bonus - $30 Off",
  },
  {
    // 8+ active referrals. Percent rather than a fixed amount so it stays
    // correct if the Member price ever moves.
    id: "QUORUM_MONTHLY_FREE",
    percent_off: 100,
    duration: "repeating",
    duration_in_months: 120,
    name: "Quorum Referral Bonus - Free",
  },
];

async function createCoupons(): Promise<void> {
  for (const coupon of coupons) {
    try {
      await stripe.coupons.retrieve(coupon.id);
      console.log(`✓ Coupon already exists: ${coupon.id}`);
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await stripe.coupons.create(coupon as any);
      console.log(`✓ Created coupon: ${coupon.id}`);
    }
  }
  console.log("\n✓ All coupons ready");
}

createCoupons().catch((err) => {
  console.error(err);
  process.exit(1);
});
