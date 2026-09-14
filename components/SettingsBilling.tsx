"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TierPill from "@/components/TierPill";

type Sub = {
  tier: "free" | "member" | "partner";
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  has_stripe_subscription: boolean;
  /** Paid, or mid-trial. Gate on this, not the tier string (a card-free trial
   *  reports tier "free"). */
  has_full_access: boolean;
  access_reason: "paid" | "trial" | "none";
  is_trialing: boolean;
};

function fmtDate(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Whole days remaining until `ts` (0 once it's in the past).
function daysLeft(ts: string | null): number {
  if (!ts) return 0;
  const diff = new Date(ts).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}

// There is no free tier: an account without a membership or a live trial can
// read, but its write limits are zero. Say so, rather than naming a plan that
// doesn't exist.
function statusLine(sub: Sub): { text: string; color: string } {
  if (sub.cancel_at_period_end) {
    return { text: `Cancels ${fmtDate(sub.current_period_end)}`, color: "#484f58" };
  }
  if (sub.status === "past_due") {
    return { text: "Payment failed — update your card", color: "#f85149" };
  }
  if (sub.status === "trialing") {
    const d = daysLeft(sub.trial_ends_at);
    // An expired trial must read as expired — never a stale future-tense
    // "trial ends" with a past date sitting next to "Unlimited".
    if (d <= 0) {
      return { text: "Trial ended — add a card to keep your cohort seat", color: "#484f58" };
    }
    return { text: `Trial ends in ${d} ${d === 1 ? "day" : "days"}`, color: "var(--accent)" };
  }
  if (sub.access_reason === "paid") {
    return {
      text: sub.current_period_end
        ? `Active — next billing ${fmtDate(sub.current_period_end)}`
        : "Active",
      color: "#22c55e",
    };
  }
  if (sub.status === "canceled") {
    return { text: "Membership ended — rejoin to post, reply, and message", color: "#484f58" };
  }
  return { text: "No active membership — join to post, reply, and message", color: "#484f58" };
}

export default function SettingsBilling() {
  const router = useRouter();
  const [sub, setSub] = useState<Sub | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSub(d))
      .catch(() => {});
  }, []);

  async function manageBilling() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/subscription", { method: "POST" });
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    } finally {
      setPortalLoading(false);
    }
  }

  const tier = sub?.tier ?? "free";
  const status = sub ? statusLine(sub) : null;
  // Accounts with no Stripe subscription (a card-free trial, or no membership
  // at all) get a path to a plan instead of the billing portal.
  const showUpgrade = tier === "free" && !sub?.has_stripe_subscription;

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-default)",
    borderRadius: 4,
    padding: 24,
    marginBottom: 16,
  };

  return (
    <>
      {/* Subscription card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="font-sans" style={{ fontSize: 16, color: "var(--text-primary)" }}>
            Billing &amp; Subscription
          </span>
          <TierPill tier={tier} />
        </div>

        {status && (
          <p className="font-mono" style={{ fontSize: 11, color: status.color, marginTop: 12 }}>
            {status.text}
          </p>
        )}

        {/* Access this month. There are no metered free limits to show: an
            account either has full access or can't write at all. */}
        <div style={{ marginTop: 16 }}>
          <p
            className="font-mono uppercase"
            style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", marginBottom: 12 }}
          >
            This month
          </p>
          {!sub ? (
            <p className="font-mono" style={{ fontSize: 10, color: "var(--text-disabled)" }}>
              Loading…
            </p>
          ) : sub.has_full_access ? (
            <p className="font-mono" style={{ fontSize: 11, color: "#22c55e" }}>
              Unlimited
            </p>
          ) : (
            <p className="font-sans" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              You can read everything. Posting, replies, and messages open up with a membership.
            </p>
          )}
        </div>

        {/* Manage / Upgrade button */}
        <button
          onClick={showUpgrade ? () => router.push("/pricing") : manageBilling}
          disabled={portalLoading}
          className="font-mono billing-manage-btn"
          style={{
            fontSize: 11,
            letterSpacing: "0.06em",
            padding: "12px 20px",
            width: "100%",
            textAlign: "left",
            marginTop: 20,
            opacity: portalLoading ? 0.7 : 1,
          }}
        >
          {portalLoading
            ? "Opening…"
            : showUpgrade
              ? sub?.is_trialing
                ? "Choose a plan →"
                : "Become a member →"
              : "Manage billing & subscription →"}
        </button>
      </div>

      {/* Notifications placeholder */}
      <div style={cardStyle}>
        <span className="font-sans" style={{ fontSize: 16, color: "var(--text-primary)" }}>
          Notifications
        </span>
        <p className="font-sans" style={{ fontSize: 14, color: "var(--text-disabled)", marginTop: 12 }}>
          Notification preferences coming soon.
        </p>
      </div>
    </>
  );
}
