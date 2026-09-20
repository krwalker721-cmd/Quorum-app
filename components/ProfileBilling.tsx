"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TierPill from "@/components/TierPill";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";

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

function daysLeft(ts: string | null): number {
  if (!ts) return 0;
  const diff = new Date(ts).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}

// There is no free tier: an account without a membership or a live trial can
// read, but its write limits are zero. Say so, rather than naming a plan that
// doesn't exist.
function statusText(sub: Sub | null): string {
  if (!sub) return "Loading…";
  if (sub.cancel_at_period_end) return `Cancels ${fmtDate(sub.current_period_end)}`;
  if (sub.status === "past_due") return "Payment failed — update your card";
  if (sub.status === "trialing") {
    const d = daysLeft(sub.trial_ends_at);
    if (d <= 0) return "Trial ended — add a card to keep your cohort seat";
    return `Trial ends in ${d} ${d === 1 ? "day" : "days"}`;
  }
  if (sub.access_reason === "paid") {
    return sub.current_period_end
      ? `Active — next billing ${fmtDate(sub.current_period_end)}`
      : "Active";
  }
  if (sub.status === "canceled") return "Membership ended — rejoin to post, reply, and message";
  return "No active membership — join to post, reply, and message";
}

function upgradeLabel(sub: Sub | null): string {
  return sub?.is_trialing ? "Choose a plan →" : "Become a member →";
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
    <Tile kicker="Billing" right={<TierPill sleek tier={tier} />}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{statusText(sub)}</p>
      <button
        type="button"
        onClick={handleManageBilling}
        disabled={loading}
        className={showUpgrade ? ui.softBtn : ui.ghostBtn}
        style={{ marginTop: 14 }}
      >
        {loading ? "Opening…" : showUpgrade ? upgradeLabel(sub) : "Manage billing →"}
      </button>
    </Tile>
  );
}
