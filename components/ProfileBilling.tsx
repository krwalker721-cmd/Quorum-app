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

function fmtDate(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusText(sub: Sub | null): string {
  if (!sub) return "Loading…";
  if (sub.cancel_at_period_end) return `Cancels ${fmtDate(sub.current_period_end)}`;
  switch (sub.status) {
    case "trialing":
      return `Trial ends ${fmtDate(sub.trial_ends_at)}`;
    case "active":
      return `Active — next billing ${fmtDate(sub.current_period_end)}`;
    case "past_due":
      return "Payment failed — update your card";
    case "canceled":
      return "Subscription canceled";
    default:
      return "Free plan — read everything, post within limits";
  }
}

// Compact billing card shown only on the owner's own profile.
export default function ProfileBilling() {
  const router = useRouter();
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSub(d))
      .catch(() => {});
  }, []);

  const tier = sub?.tier ?? "free";
  const showUpgrade = tier === "free" && !sub?.has_stripe_subscription;

  async function handleManageBilling() {
    if (showUpgrade) {
      router.push("/pricing");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/subscription", { method: "POST" });
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 4,
        padding: 20,
        marginTop: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span className="font-sans" style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
          Billing &amp; Subscription
        </span>
        <TierPill tier={tier} />
      </div>

      <p
        className="font-mono"
        style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 16, letterSpacing: "0.04em" }}
      >
        {statusText(sub)}
      </p>

      <button
        onClick={handleManageBilling}
        disabled={loading}
        className="font-mono"
        style={{
          background: "transparent",
          border: "1px solid var(--border-default)",
          borderRadius: 4,
          color: "var(--text-secondary)",
          fontSize: 11,
          letterSpacing: "0.06em",
          padding: "10px 16px",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading
          ? "Opening…"
          : showUpgrade
            ? "Upgrade to Member →"
            : "Manage billing & subscription →"}
      </button>
    </div>
  );
}
