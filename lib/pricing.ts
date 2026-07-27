// Single source of truth for what Quorum costs and what the tiers mean.
//
// Positioning note, because it explains every number below: Quorum's value is
// the other founders in the room, so the price is also the filter. Comparable
// stage-tiered founder networks start around $42/mo (Founders Network) and run
// to $58/mo (Dynamite Circle); facilitated peer groups start at $150/mo and go
// far higher. Quorum sits at the bottom of that band because it's software with
// no facilitation or events — but deliberately well clear of consumer-app
// pricing, which would signal an unfiltered room.

export const PRICING = {
  member: {
    monthly: 39,
    /** Two months free — annual prepay is the main lever against the 5–10%
     *  monthly churn that paid communities average. */
    annual: 390,
  },
  /** Locked for life for the first FOUNDING_SEATS members. Honest pricing for
   *  the fact that early cohorts are still filling. */
  founding: {
    monthly: 19,
  },
  partner: {
    monthly: 99,
  },
} as const;

/** How many founding-rate seats exist before the rate closes for good. */
export const FOUNDING_SEATS = 100;

/** Trial length in days. The core loop is weekly, so a trial has to span
 *  several check-in cycles to demonstrate anything at all — a 7-day trial shows
 *  exactly one. Referred founders get a longer run as the invitee-side half of
 *  the referral incentive. */
export const TRIAL_DAYS = {
  standard: 30,
  referred: 45,
} as const;

/** Grace window after a trial or subscription lapses, during which the member
 *  keeps their cohort seat and sees escalating prompts. After this the seat is
 *  released back to the pool. */
export const LAPSE_GRACE_DAYS = 7;

/** One month of credit per referral who activates and stays. Uncapped: a member
 *  who fills a cohort rides free, which during cold start is the best possible
 *  outcome rather than a leak. */
export const REFERRAL_CREDIT_MONTHS_PER_ACTIVATION = 1;

/** Display helper so copy never drifts from the numbers above. */
export function formatPrice(amount: number): string {
  return `$${amount}`;
}
