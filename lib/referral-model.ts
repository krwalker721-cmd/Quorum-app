import { PRICING, REFERRAL_CREDIT_MONTHS_PER_ACTIVATION } from "@/lib/pricing";

// What referrals actually are, in one place.
//
// This file exists because the onboarding pitch and the /referrals dashboard
// were describing two different products. Onboarding promised a ladder of free
// months (1 → 1 month, 5 → 2 months, 25 → free for a year); the app pays one
// month per activated referral with no cap and treats the ladder as badges. A
// founder was being sold a scheme that didn't exist, then shown the real one.
//
// Both surfaces now render from these constants. The reward mechanics themselves
// live in lib/referral-credit.ts (the money) and lib/referral-helpers.ts (the
// badges and the unlock gates) — the values below describe that behaviour and
// must not drift from it.

/** The economics: one month of Member per referral who activates, uncapped. */
export const REFERRAL_CREDIT = {
  monthsPerActivation: REFERRAL_CREDIT_MONTHS_PER_ACTIVATION,
  dollarsPerActivation: PRICING.member.monthly * REFERRAL_CREDIT_MONTHS_PER_ACTIVATION,
  /** Kept honest with lib/referral-credit.ts, which never caps a grant. */
  uncapped: true,
} as const;

/**
 * The milestone ladder — recognition, not money. Every referral is already paid
 * for in credit; paying free months here as well would credit the same referral
 * twice. Mirrors MILESTONE_BADGE / REWARD_MESSAGES in lib/referral-helpers.ts.
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
 * The gates are what stop a drive-by account from farming credit, which is why
 * the link is earned rather than handed out at signup.
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
    title: "You earn a free month",
    sub: `$${REFERRAL_CREDIT.dollarsPerActivation} of Member credit, applied automatically. No cap.`,
  },
];
