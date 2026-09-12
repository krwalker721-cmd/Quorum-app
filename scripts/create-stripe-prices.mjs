// Creates (or verifies) Quorum's four subscription prices in whichever Stripe
// account and mode the supplied key belongs to. Every amount is read from
// lib/pricing.ts, so what Stripe charges can't drift from what the app shows.
//
// DRY RUN BY DEFAULT. Without --apply it prints the account's public profile and
// exactly what it would create, and creates nothing.
//
// Run (needs Node 22.18+ / 23.6+ to import lib/pricing.ts natively). A macOS
// dialog asks for the key, so it never lands in shell history or .env.local:
//
//   STRIPE_SECRET_KEY="$(osascript -e 'text returned of (display dialog "Paste your LIVE Stripe secret key:" default answer "" with hidden answer)')" node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/create-stripe-prices.mjs
//   ...same, with --apply on the end, to create.
//
// Why .mjs and not .ts: tsconfig includes **/*.ts, so a .ts file here gets
// type-checked by `next build`, and the type-checker demands extensionless
// relative imports that Node itself can't resolve. A plain .mjs sits outside
// the build and can still import lib/pricing.ts directly.
//
// Idempotent. Products use fixed ids and prices use lookup keys, so re-running
// is safe. An existing price that disagrees with lib/pricing.ts is reported and
// left alone: Stripe prices are immutable, and re-pointing a lookup key at a new
// price is a decision to make deliberately, not a side effect of a setup script.
//
// tax_behavior is deliberately left unset. If Stripe Tax is adopted later it
// can still be set once per price.

import { PRICING } from "../lib/pricing.ts";
import { stripeFromEnv } from "./stripe-key.mjs";

const APPLY = process.argv.includes("--apply");
const { stripe, mode } = stripeFromEnv();

const PRODUCTS = [
  {
    id: "quorum_member",
    name: "Quorum Member",
    description: "Membership in Quorum, a private community for founders.",
  },
  {
    id: "quorum_founding",
    name: "Quorum Founding Member",
    description: "Quorum membership at the founding rate, locked for life.",
  },
  {
    id: "quorum_partner",
    name: "Quorum Partner",
    description: "Quorum Partner membership.",
  },
];

// `env` must match PLAN_ENV in lib/plans.ts — that's what the app reads.
const PRICES = [
  {
    env: "STRIPE_MEMBER_PRICE_ID",
    lookupKey: "quorum_member_monthly",
    product: "quorum_member",
    amount: PRICING.member.monthly,
    interval: "month",
    nickname: "Member — monthly",
  },
  {
    env: "STRIPE_MEMBER_ANNUAL_PRICE_ID",
    lookupKey: "quorum_member_annual",
    product: "quorum_member",
    amount: PRICING.member.annual,
    interval: "year",
    nickname: "Member — annual",
  },
  {
    env: "STRIPE_FOUNDING_PRICE_ID",
    lookupKey: "quorum_founding_monthly",
    product: "quorum_founding",
    amount: PRICING.founding.monthly,
    interval: "month",
    nickname: "Founding — monthly, locked for life",
  },
  {
    // Partner isn't shipped. Creating the price is harmless; leaving
    // STRIPE_PARTNER_PRICE_ID unset in Vercel is what keeps checkout closed.
    env: "STRIPE_PARTNER_PRICE_ID",
    lookupKey: "quorum_partner_monthly",
    product: "quorum_partner",
    amount: PRICING.partner.monthly,
    interval: "month",
    nickname: "Partner — monthly",
  },
];

// What the dashboard work in LAUNCH.md Phase 2 should have produced. Mismatches
// are warnings only — none of them affect price creation. The brand color is
// the dark page background rather than amber, kept deliberately (2026-09-12):
// dark chrome with amber buttons is the app's own pairing.
const EXPECTED_PROFILE = {
  name: "Quorum",
  url: "https://quorumhq.co",
  descriptor: "QUORUM",
  brandColor: "#0d1117",
  accentColor: "#f59e0b",
};

const norm = (v) => String(v ?? "").trim().toLowerCase().replace(/\/+$/, "");

function row(ok, label, value, expected) {
  const shown = value === null || value === undefined || value === "" ? "(not set)" : value;
  const hint = ok || expected === undefined ? "" : `   ← expected ${expected}`;
  console.log(`  ${ok ? "✓" : "⚠"} ${label.padEnd(20)} ${shown}${hint}`);
  return ok;
}

async function checkAccount() {
  const acct = await stripe.accounts.retrieve();
  const bp = acct.business_profile ?? {};
  const branding = acct.settings?.branding ?? {};
  const descriptor = acct.settings?.payments?.statement_descriptor;
  const e = EXPECTED_PROFILE;

  console.log(`Account ${acct.id}`);
  const results = [
    row(acct.charges_enabled === true, "charges_enabled", String(acct.charges_enabled), "true"),
    row(acct.payouts_enabled === true, "payouts_enabled", String(acct.payouts_enabled), "true"),
    row(norm(bp.name) === norm(e.name), "public name", bp.name, e.name),
    row(norm(bp.url) === norm(e.url), "website", bp.url, e.url),
    row(Boolean(bp.support_email), "support email", bp.support_email),
    row(norm(descriptor) === norm(e.descriptor), "statement descriptor", descriptor, e.descriptor),
    row(norm(branding.primary_color) === e.brandColor, "brand color", branding.primary_color, e.brandColor),
    row(norm(branding.secondary_color) === e.accentColor, "accent color", branding.secondary_color, e.accentColor),
    row(Boolean(branding.icon), "icon", branding.icon ? "set" : null),
    row(Boolean(branding.logo), "logo", branding.logo ? "set" : null),
  ];
  const flagged = results.filter((ok) => !ok).length;
  console.log(flagged ? `  → ${flagged} profile item(s) need attention\n` : "  → profile looks right\n");
}

async function ensureProduct(p) {
  try {
    const existing = await stripe.products.retrieve(p.id);
    return existing.active ? "exists" : "exists but ARCHIVED — unarchive it in the dashboard";
  } catch (err) {
    if (err?.code !== "resource_missing") throw err;
  }
  if (!APPLY) return "would create";
  await stripe.products.create({
    id: p.id,
    name: p.name,
    description: p.description,
    metadata: { source: "scripts/create-stripe-prices.mjs" },
  });
  return "created";
}

async function ensurePrice(p) {
  const cents = Math.round(p.amount * 100);
  const { data } = await stripe.prices.list({ lookup_keys: [p.lookupKey], limit: 1 });
  const existing = data[0];

  if (existing) {
    const productId = typeof existing.product === "string" ? existing.product : existing.product.id;
    const problems = [];
    if (existing.unit_amount !== cents) problems.push(`amount is ${existing.unit_amount}¢, pricing.ts says ${cents}¢`);
    if (existing.currency !== "usd") problems.push(`currency is ${existing.currency}`);
    if (existing.recurring?.interval !== p.interval) problems.push(`interval is ${existing.recurring?.interval}, expected ${p.interval}`);
    if ((existing.recurring?.interval_count ?? 1) !== 1) problems.push(`interval_count is ${existing.recurring.interval_count}`);
    if (!existing.active) problems.push("price is archived");
    if (productId !== p.product) problems.push(`belongs to ${productId}, expected ${p.product}`);
    return { id: existing.id, status: problems.length ? "MISMATCH" : "exists", problems };
  }

  if (!APPLY) return { id: null, status: "would create", problems: [] };

  const created = await stripe.prices.create({
    product: p.product,
    currency: "usd",
    unit_amount: cents,
    recurring: { interval: p.interval },
    lookup_key: p.lookupKey,
    nickname: p.nickname,
    metadata: { source: "scripts/create-stripe-prices.mjs" },
  });
  return { id: created.id, status: "created", problems: [] };
}

async function main() {
  console.log(`\nStripe mode: ${mode}${APPLY ? "" : "   (DRY RUN — nothing will be created)"}\n`);

  await checkAccount();

  console.log("Products");
  for (const p of PRODUCTS) {
    console.log(`  ${p.id.padEnd(18)} ${await ensureProduct(p)}`);
  }

  console.log("\nPrices");
  const results = [];
  for (const p of PRICES) {
    const r = await ensurePrice(p);
    results.push({ ...p, ...r });
    const money = `$${p.amount}/${p.interval === "year" ? "yr" : "mo"}`;
    console.log(`  ${p.lookupKey.padEnd(24)} ${money.padEnd(9)} ${r.status}${r.id ? `  ${r.id}` : ""}`);
    for (const problem of r.problems) console.log(`      ✗ ${problem}`);
  }

  const mismatched = results.filter((r) => r.status === "MISMATCH");
  if (mismatched.length) {
    console.log(
      `\n✗ ${mismatched.length} existing price(s) disagree with lib/pricing.ts. Nothing was changed\n` +
        "  for them. Decide deliberately whether to archive the old price and re-run.",
    );
    process.exit(1);
  }

  if (!APPLY) {
    console.log("\nDry run complete. Re-run with --apply to create what's marked 'would create'.");
    return;
  }

  console.log(`\nVercel env vars (${mode} mode) — set these in Vercel, not only .env.local:\n`);
  for (const r of results) console.log(`${r.env}=${r.id}`);
  console.log();
}

main().catch((err) => {
  console.error(`\n✗ ${err?.message ?? err}`);
  process.exit(1);
});
