import { PRICING, FOUNDING_SEATS, LAPSE_GRACE_DAYS } from "@/lib/pricing";

// Product and FAQ copy shared by the landing page and /pricing, so the two
// public pages can't drift into saying different things.

export const PRODUCT_BLOCKS = [
  {
    color: "#f59e0b",
    title: "Your Cohort",
    desc: "A private group of 12 vetted founders with the same drive as you. Real talk, real problems, real answers — no noise.",
  },
  {
    color: "#58a6ff",
    title: "The Pulse Feed",
    desc: "A network-wide feed where founders share decisions, wins, blockers, and questions. The honest version of LinkedIn.",
  },
  {
    color: "#22c55e",
    title: "The Collab Board",
    desc: "Post projects, find co-builders, list needs, and hire from a network you already trust. Work gets done here.",
  },
  {
    color: "#a78bfa",
    title: "The Vault",
    desc: "Save resources, write notes with a full rich editor, and access community wisdom nominated by the best founders in the network.",
  },
];

export const FAQ_ITEMS = [
  {
    q: "Can I cancel anytime?",
    a: "Yes — cancel from your settings page at any time. Memberships renew automatically until you do; once you cancel, you keep access until the end of the period you've paid for. Payments aren't refunded, including partial periods.",
  },
  {
    q: "What happens when my trial ends?",
    a: `No surprise charges — we never charge a card you didn't add. (If you added a card to claim a referral trial, your membership starts on the trial's end date unless you cancel first.) Your cohort seat is held for ${LAPSE_GRACE_DAYS} days, and you keep read access to everything you were part of. After that the seat returns to the pool so the room stays full of people who show up.`,
  },
  {
    q: "Why isn't there a free plan?",
    a: "Because a cohort is twelve seats, and a seat nobody uses costs the eleven founders around it. Charging is what keeps the room worth being in. The trial is a full month — long enough to live through four weekly cycles and decide honestly.",
  },
  {
    q: "How do referrals work?",
    a: "Share your invite link. Every founder who joins and stays active brings your own price down — $10 off a month at one, $30 at five, free at eight. It tracks who is still active, so it rewards people you actually keep in the room. Fill a cohort of twelve and Quorum is free.",
  },
  {
    q: "Is the founding rate really locked?",
    a: `Yes. The first ${FOUNDING_SEATS} members pay $${PRICING.founding.monthly}/month for as long as they stay members, even after the standard price rises.`,
  },
];
