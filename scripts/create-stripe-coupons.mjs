// Creates (or verifies) the referral-bonus coupons that lib/referral-bonus.ts
// attaches by hard-coded id. Without them every referral bonus fails silently
// and the referrer just keeps paying full price.
//
// The ids and amounts are read from BONUS_TIERS in lib/referral-model.ts — the
// same ladder the onboarding pitch renders and the billing code applies — so
// the coupons in Stripe can't drift from what founders are promised.
//
// DRY RUN BY DEFAULT. Without --apply it reports what exists and what it would
// create, and creates nothing. Run once per Stripe account and mode.
//
// Run (needs Node 22.15+ / 23.5+). A macOS dialog asks for the key, so it never
// lands in shell history or .env.local:
//
//   STRIPE_SECRET_KEY="$(osascript -e 'text returned of (display dialog "Paste your LIVE Stripe secret key:" default answer "" with hidden answer)')" node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/create-stripe-coupons.mjs
//   ...same, with --apply on the end, to create.
//
// Idempotent: coupons use fixed ids. An existing coupon whose terms disagree is
// reported and left alone — coupon terms are immutable in Stripe, and replacing
// one already attached to subscriptions is a decision, not a side effect.
//
// Replaces create-stripe-coupons.ts, whose ts-node command stopped working once
// Node began handling .ts files natively. See create-stripe-prices.mjs for why
// these scripts are .mjs.

import { registerHooks } from "node:module";
import { stripeFromEnv } from "./stripe-key.mjs";

// lib/referral-model.ts imports "@/lib/pricing" — the tsconfig path alias, which
// Node doesn't understand. Resolve "@/x" to <repo>/x.ts for this process so the
// real module can be imported instead of keeping a copy of the ladder here.
const ROOT = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const path = specifier.slice(2);
      const withExt = /\.[cm]?[jt]sx?$/.test(path) ? path : `${path}.ts`;
      return nextResolve(new URL(withExt, ROOT).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { BONUS_TIERS } = await import("../lib/referral-model.ts");

const APPLY = process.argv.includes("--apply");
const { stripe, mode } = stripeFromEnv();

// Several tiers can share a coupon (8 and 12 active are both FREE), but Stripe
// needs each coupon once.
const COUPONS = [...new Map(BONUS_TIERS.map((t) => [t.coupon, t])).values()].map((t) => ({
  id: t.coupon,
  name:
    t.amountOff === null
      ? "Quorum Referral Bonus - Free"
      : `Quorum Referral Bonus - $${t.amountOff} Off`,
  // amountOff null means 100% off. Percent rather than a fixed amount so free
  // stays free if the Member price ever moves.
  ...(t.amountOff === null
    ? { percent_off: 100 }
    : { amount_off: Math.round(t.amountOff * 100), currency: "usd" }),
  // Ten years repeating = effectively permanent; lib/referral-bonus.ts removes
  // the coupon the moment it's no longer earned. Matches the test-mode coupons.
  duration: "repeating",
  duration_in_months: 120,
}));

function problemsWith(existing, want) {
  const problems = [];
  const show = (v) => v ?? "none";
  if ((existing.percent_off ?? null) !== (want.percent_off ?? null)) {
    problems.push(`percent_off is ${show(existing.percent_off)}, expected ${show(want.percent_off)}`);
  }
  if ((existing.amount_off ?? null) !== (want.amount_off ?? null)) {
    problems.push(`amount_off is ${show(existing.amount_off)}, expected ${show(want.amount_off)}`);
  }
  if (want.currency && existing.currency !== want.currency) {
    problems.push(`currency is ${show(existing.currency)}, expected ${want.currency}`);
  }
  if (existing.duration !== want.duration) {
    problems.push(`duration is ${existing.duration}, expected ${want.duration}`);
  }
  if ((existing.duration_in_months ?? null) !== want.duration_in_months) {
    problems.push(`duration_in_months is ${show(existing.duration_in_months)}, expected ${want.duration_in_months}`);
  }
  if (!existing.valid) problems.push("coupon is no longer valid (expired or fully redeemed)");
  return problems;
}

async function main() {
  console.log(`\nStripe mode: ${mode}${APPLY ? "" : "   (DRY RUN — nothing will be created)"}`);
  const acct = await stripe.accounts.retrieve();
  console.log(`Account ${acct.id}\n`);

  console.log("Coupons");
  let mismatched = 0;
  for (const c of COUPONS) {
    const off = c.percent_off ? `${c.percent_off}% off` : `$${c.amount_off / 100} off`;
    let status;
    let problems = [];

    try {
      const existing = await stripe.coupons.retrieve(c.id);
      problems = problemsWith(existing, c);
      status = problems.length ? "MISMATCH" : "exists";
    } catch (err) {
      if (err?.code !== "resource_missing") throw err;
      if (APPLY) {
        await stripe.coupons.create({
          ...c,
          metadata: { source: "scripts/create-stripe-coupons.mjs" },
        });
        status = "created";
      } else {
        status = "would create";
      }
    }

    if (status === "MISMATCH") mismatched++;
    console.log(`  ${c.id.padEnd(22)} ${off.padEnd(10)} ${status}`);
    for (const problem of problems) console.log(`      ✗ ${problem}`);
  }

  if (mismatched) {
    console.log(
      `\n✗ ${mismatched} existing coupon(s) disagree with lib/referral-model.ts. Nothing was\n` +
        "  changed for them. Decide deliberately whether to delete and re-create.",
    );
    process.exit(1);
  }

  console.log(
    APPLY
      ? "\n✓ All referral coupons ready."
      : "\nDry run complete. Re-run with --apply to create what's marked 'would create'.",
  );
}

main().catch((err) => {
  console.error(`\n✗ ${err?.message ?? err}`);
  process.exit(1);
});
