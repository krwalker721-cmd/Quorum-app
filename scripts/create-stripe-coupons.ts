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
  // Milestones 1/3/5/10 are applied as one-off customer balance credits, not
  // these coupons, but we still create them so the catalog is complete and
  // auditable. Rewards are denominated in free months of Member ($12/mo). Stripe
  // caps coupon `name` at 40 chars, so these are kept short; the coupon id
  // encodes the exact milestone.
  {
    id: "QUORUM_MILESTONE_1",
    amount_off: 1200, // cents — 1 free month
    currency: "usd",
    duration: "once",
    name: "Quorum Referral - 1 Free Month",
  },
  {
    id: "QUORUM_MILESTONE_3",
    amount_off: 1200, // 1 free month
    currency: "usd",
    duration: "once",
    name: "Quorum Referral - 1 Free Month",
  },
  {
    id: "QUORUM_MILESTONE_5",
    amount_off: 2400, // 2 free months
    currency: "usd",
    duration: "once",
    name: "Quorum Referral - 2 Free Months",
  },
  {
    id: "QUORUM_MILESTONE_10",
    amount_off: 3600, // 3 free months
    currency: "usd",
    duration: "once",
    name: "Quorum Referral - 3 Free Months",
  },
  // ── Milestone rewards (recurring) ─────────────────────────────────────────
  {
    id: "QUORUM_MILESTONE_25",
    percent_off: 100,
    duration: "repeating",
    duration_in_months: 12,
    name: "Quorum Referral - Free Year",
  },
  // NOTE: QUORUM_MONTHLY_50 (the old standing "50% off forever off one
  // referral" bonus) is intentionally gone. Referral rewards are now customer
  // balance credit — one month of Member per activated referral — granted in
  // lib/referral-credit.ts, which needs no coupons at all. Any coupon still
  // attached to a live subscription is detached by
  // scripts/retire-monthly-bonus.ts.
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
