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
};

type Usage = {
  tier: string;
  usage: Record<string, number>;
  limits: Record<string, number>;
};

const FEATURE_LABELS: Record<string, string> = {
  cohort_posts: "cohort posts",
  pulse_posts: "pulse posts",
  replies: "replies",
  messages: "messages",
  vault_notes: "vault notes",
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

function statusLine(sub: Sub): { text: string; color: string } {
  if (sub.cancel_at_period_end) {
    return { text: `Cancels ${fmtDate(sub.current_period_end)}`, color: "#484f58" };
  }
  switch (sub.status) {
    case "trialing": {
      const d = daysLeft(sub.trial_ends_at);
      // An expired trial must read as expired — never a stale future-tense
      // "trial ends" with a past date sitting next to "Unlimited".
      if (d <= 0) {
        return { text: "Trial expired — you're on the free tier", color: "#484f58" };
      }
      return { text: `Trial ends in ${d} ${d === 1 ? "day" : "days"}`, color: "var(--accent)" };
    }
    case "active":
      if (sub.tier === "free") {
        return { text: "Free tier", color: "#484f58" };
      }
      return { text: `Active — next billing ${fmtDate(sub.current_period_end)}`, color: "#22c55e" };
    case "past_due":
      return { text: "Payment failed — update your card", color: "#f85149" };
    case "canceled":
      return { text: "Subscription cancelled", color: "#484f58" };
    default:
      return { text: "Free tier", color: "#484f58" };
  }
}

export default function SettingsBilling() {
  const router = useRouter();
  const [sub, setSub] = useState<Sub | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSub(d))
      .catch(() => {});
    fetch("/api/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUsage(d))
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
  const isFree = tier === "free";
  const status = sub ? statusLine(sub) : null;
  // Free users with no Stripe subscription get an upgrade prompt instead.
  const showUpgrade = isFree && !sub?.has_stripe_subscription;

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

        {/* Usage this month */}
        <div style={{ marginTop: 16 }}>
          <p
            className="font-mono uppercase"
            style={{ fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.1em", marginBottom: 12 }}
          >
            This month
          </p>

          {isFree ? (
            usage ? (
              Object.entries(FEATURE_LABELS).map(([key, label]) => {
                const limit = usage.limits[key] ?? 0;
                const current = usage.usage[key] ?? 0;
                if (limit <= 0) return null;
                const pct = Math.min(100, Math.round((current / limit) * 100));
                return (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span className="font-mono" style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                        {label}
                      </span>
                      <span className="font-mono" style={{ fontSize: 10, color: "var(--text-disabled)" }}>
                        {current} / {limit}
                      </span>
                    </div>
                    <div style={{ height: 3, background: "var(--border-default)", borderRadius: 2 }}>
                      <div
                        style={{
                          height: 3,
                          width: `${pct}%`,
                          background: "var(--accent)",
                          borderRadius: 2,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="font-mono" style={{ fontSize: 10, color: "var(--text-disabled)" }}>
                Loading usage…
              </p>
            )
          ) : (
            <p className="font-mono" style={{ fontSize: 11, color: "#22c55e" }}>
              Unlimited
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
              ? "Upgrade to Member →"
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
