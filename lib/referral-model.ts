import { PRICING } from "@/lib/pricing";

// What referrals actually are, in one place.
//
// This file exists because the onboarding pitch and the /referrals dashboard
// were describing two different products — a founder was sold one scheme and
// then shown another. Both surfaces render from the constants below.
//
// It is deliberately CLIENT-SAFE: no Stripe, no Supabase, no server imports.
// lib/referral-bonus.ts imports the ladder FROM here to do the Stripe work, so
// the numbers a founder is promised and the numbers we actually bill cannot
// drift apart.

/**
 * The standing referral bonus: a recurring discount sized by how many of your
 * referrals are CURRENTLY active, recalculated whenever that count moves.
 *
 * The "currently active" part is the whole point. A one-off bounty pays for a
 * signup; this pays for people who stay, so a referrer has a reason to care
 * whether the room they filled is still alive. Let your referrals go quiet and
 * the bonus shrinks with them.
 *
 * The ladder runs to 12 — a full cohort — rather than stopping at 5 like the
 * original version, because when a room is twelve seats, five is the wrong
 * place to stop paying.
 *
 * Ordered high → low; the first tier a count satisfies is the one it holds.
 */
export const BONUS_TIERS: {
  /** Minimum currently-active referrals to hold this tier. */
  min: number;
  /** Stripe coupon id. Must exist — see scripts/create-stripe-coupons.ts. */
  coupon: string;
  /** Dollars off the monthly price. null = 100% off. */
  amountOff: number | null;
  label: string;
}[] = [
  { min: 12, coupon: "QUORUM_MONTHLY_FREE", amountOff: null, label: "free — you filled a room" },
  { min: 8, coupon: "QUORUM_MONTHLY_FREE", amountOff: null, label: "free every month" },
  { min: 5, coupon: "QUORUM_MONTHLY_30", amountOff: 30, label: "$30 off every month" },
  { min: 3, coupon: "QUORUM_MONTHLY_20", amountOff: 20, label: "$20 off every month" },
  { min: 1, coupon: "QUORUM_MONTHLY_10", amountOff: 10, label: "$10 off every month" },
];

/** The tier a given active-referral count earns (null = no bonus). */
export function tierFor(activeCount: number) {
  return BONUS_TIERS.find((t) => activeCount >= t.min) ?? null;
}

/** What you'd pay at a given tier, for copy that quotes a number. */
export function pricePaidAt(amountOff: number | null): number {
  return amountOff === null ? 0 : Math.max(0, PRICING.member.monthly - amountOff);
}

/** Low → high, for rendering the ladder as a progression. */
export const BONUS_LADDER_ASC = [...BONUS_TIERS].reverse();

/**
 * The milestone ladder — recognition, not money. Every referral is already paid
 * for by the standing bonus; paying free months here as well would credit the
 * same referral twice, which is what an earlier version of this did. Mirrors
 * MILESTONE_BADGE / REWARD_MESSAGES in lib/referral-helpers.ts.
 */
export const REFERRAL_MILESTONES: { count: number; reward: string }[] = [
  { count: 1, reward: "Connector badge" },
  { count: 3, reward: "Connector — confirmed" },
  { count: 5, reward: "Builder of Rooms badge" },
  { count: 10, reward: "Builder of Rooms — gold" },
  { count: 25, reward: "Founding Connector badge" },
];

/**
 * What has to be true before a referral link goes live. Keys match the object
 * returned by checkActivityGates() in lib/referral-helpers.ts, which is the
 * server's answer — these are labels for it, not a second implementation.
 *
 * The gates are what stop a drive-by account from farming the bonus, which is
 * why the link is earned rather than handed out at signup.
 */
export type ReferralGateKey =
  | "profileComplete"
  | "returnedThreeDays"
  | "engagedWithPulse";

export const REFERRAL_LINK_GATES: {
  key: ReferralGateKey;
  title: string;
  sub: string;
}[] = [
  {
    key: "profileComplete",
    title: "Complete your profile",
    sub: "Your stage, your skills, and what you're building",
  },
  {
    key: "returnedThreeDays",
    title: "Show up on three days",
    sub: "Enough to know whether this room is for you",
  },
  {
    key: "engagedWithPulse",
    title: "Post or reply on the pulse feed",
    sub: "Say something real before you invite anyone",
  },
];

/** One-line summary of the unlock condition, for tight spaces. */
export const REFERRAL_LINK_GATE_SUMMARY =
  "complete your profile, show up on three days, and post or reply on pulse";

/** The full loop, start to payout. Shown in onboarding and on the dashboard. */
export const HOW_REFERRALS_WORK: { title: string; sub: string }[] = [
  {
    title: "Unlock your link",
    sub: REFERRAL_LINK_GATE_SUMMARY,
  },
  {
    title: "Share it with founders you rate",
    sub: "They sign up through your link and get a longer trial",
  },
  {
    title: "They add a card",
    sub: "That's what activates the referral — not the signup",
  },
  {
    title: "Your price drops, and stays down",
    sub: `$10 off at one active referral, $30 at five, free at eight — for as long as they stay.`,
  },
];
