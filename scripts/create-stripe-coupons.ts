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
  // ── Milestone rewards (one-time) ──────────────────────────────────────────
  // milestones 1/3/5 are applied as one-off customer balance credits, not these
  // coupons, but we still create them so the catalog is complete and auditable.
  // Stripe caps coupon `name` at 40 chars, so these are kept short; the coupon
  // id encodes the exact milestone.
  {
    id: "QUORUM_MILESTONE_1",
    amount_off: 1000, // cents
    currency: "usd",
    duration: "once",
    name: "Quorum Referral - 1 Referral",
  },
  {
    id: "QUORUM_MILESTONE_3",
    amount_off: 4900,
    currency: "usd",
    duration: "once",
    name: "Quorum Referral - 1 Free Month",
  },
  {
    id: "QUORUM_MILESTONE_5",
    amount_off: 9800,
    currency: "usd",
    duration: "once",
    name: "Quorum Referral - 2 Free Months",
  },
  // ── Milestone rewards (recurring) ─────────────────────────────────────────
  {
    id: "QUORUM_MILESTONE_10",
    percent_off: 50,
    duration: "repeating",
    duration_in_months: 6,
    name: "Quorum Referral - 50% Off 6 Months",
  },
  {
    id: "QUORUM_MILESTONE_25",
    percent_off: 100,
    duration: "repeating",
    duration_in_months: 12,
    name: "Quorum Referral - Free Year",
  },
  // ── Monthly active-referral bonus (repeating; replaced/removed monthly) ────
  {
    id: "QUORUM_MONTHLY_10",
    amount_off: 1000,
    currency: "usd",
    duration: "repeating",
    duration_in_months: 120, // effectively permanent; removed when no longer earned
    name: "Quorum Monthly Bonus - $10 Off",
  },
  {
    id: "QUORUM_MONTHLY_20",
    amount_off: 2000,
    currency: "usd",
    duration: "repeating",
    duration_in_months: 120,
    name: "Quorum Monthly Bonus - $20 Off",
  },
  {
    id: "QUORUM_MONTHLY_30",
    amount_off: 3000,
    currency: "usd",
    duration: "repeating",
    duration_in_months: 120,
    name: "Quorum Monthly Bonus - $30 Off",
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
