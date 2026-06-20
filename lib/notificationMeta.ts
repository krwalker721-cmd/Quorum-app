// Presentation metadata for in-app notifications (the `notifications` table).
// Centralizes the label, accent color, and click-through link per notification
// type so any rendering surface (dropdown, panel, toast) stays consistent.
//
// Session 4 added the billing/trial notification types below; this maps them to
// the colors and copy specified for Session 6.

export type NotificationType =
  | "trial_ending"
  | "trial_expired"
  | "payment_failed"
  | "payment_succeeded"
  | "subscription_cancelled"
  // referral types (Session 7)
  | "referral_pending"
  | "referral_activated"
  | "referral_inactive"
  | "referral_nudge"
  | "referral_churned"
  | "referral_reward"
  | "monthly_bonus_updated"
  // pre-existing collab types
  | "join_request_approved"
  | "join_request_declined"
  | string;

export interface NotificationMeta {
  // Default copy when the stored message is empty.
  message: string;
  // Accent color (hex) for the notification.
  color: string;
  // Where clicking the notification should take the user. "billing" means open
  // the Stripe customer portal; any other value is a route to push.
  link: "/pricing" | "billing" | string;
}

const AMBER = "#f59e0b";
const GREEN = "#22c55e";
const RED = "#f85149";
const BLUE = "#58a6ff";
const MUTED = "#484f58";

const META: Record<string, NotificationMeta> = {
  trial_ending: {
    message: "your trial ends in 3 days — upgrade to keep full access",
    color: AMBER,
    link: "/pricing",
  },
  trial_expired: {
    message: "your trial has ended — you're now on the free tier",
    color: RED,
    link: "/pricing",
  },
  payment_failed: {
    message: "your payment failed — update your card to keep access",
    color: RED,
    link: "billing",
  },
  payment_succeeded: {
    message: "payment confirmed — you're all good",
    color: GREEN,
    link: "/pricing",
  },
  subscription_cancelled: {
    message: "your subscription has been cancelled — you're on the free tier",
    color: RED,
    link: "/pricing",
  },
  // Referral notification types (Session 7). All link to /referrals so the user
  // lands on the full picture. Copy here is the fallback when the stored message
  // is empty; many referral notifications carry a name-specific message.
  referral_pending: {
    message: "someone just joined using your link",
    color: BLUE,
    link: "/referrals",
  },
  referral_activated: {
    message: "a referral activated their account — milestone progress updated",
    color: GREEN,
    link: "/referrals",
  },
  referral_inactive: {
    message: "a referral is no longer active — monthly bonus recalculated",
    color: AMBER,
    link: "/referrals",
  },
  referral_nudge: {
    message:
      "a referral hasn't activated yet — they have 24 hours to claim their free month",
    color: AMBER,
    link: "/referrals",
  },
  referral_churned: {
    message: "a referral cancelled their account",
    color: MUTED,
    link: "/referrals",
  },
  referral_reward: {
    message: "you earned a referral reward!",
    color: AMBER,
    link: "/referrals",
  },
  monthly_bonus_updated: {
    message: "your monthly referral bonus has been updated",
    color: AMBER,
    link: "/referrals",
  },
  // Pre-existing collab notification types.
  join_request_approved: {
    message: "your request to join was approved",
    color: GREEN,
    link: "/collab",
  },
  join_request_declined: {
    message: "your request to join was not accepted this time",
    color: BLUE,
    link: "/collab",
  },
};

const FALLBACK: NotificationMeta = {
  message: "",
  color: BLUE,
  link: "/home",
};

// Resolve presentation metadata for a notification type. Unknown types fall back
// to a neutral blue with no special link so nothing ever fails to render.
export function notificationMeta(type: string): NotificationMeta {
  return META[type] ?? FALLBACK;
}
