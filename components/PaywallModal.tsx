"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PRICING, FOUNDING_SEATS } from "@/lib/pricing";

export type PaywallFeature =
  | "cohort_posts"
  | "pulse_posts"
  | "replies"
  | "messages"
  | "vault_notes"
  | "collab_posts";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: PaywallFeature;
  hadTrial?: boolean;
}

// What the blocked action was, in one line. Deliberately not framed as a usage
// limit: unentitled accounts have a cap of zero on every write, so "you've used
// your posts for this month" described a meter that doesn't exist. The honest
// version is that this needs a plan.
const FEATURE_LINE: Record<PaywallFeature, string> = {
  cohort_posts: "Posting to your cohort is part of Member.",
  pulse_posts: "Posting to the pulse feed is part of Member.",
  replies: "Replying is part of Member.",
  messages: "Direct messages are part of Member.",
  vault_notes: "Vault notes are part of Member.",
  collab_posts: "Posting on the collab board is part of Member.",
};

const INCLUDED = [
  "Your cohort of 12 — post, reply, and show up weekly",
  "Unlimited pulse posts, replies, and DMs",
  "Full collab board and vault",
  "Unlimited referrals — each active one cuts your price",
];

type Plan = "member" | "member_annual" | "founding";

/**
 * The upgrade decision, rendered over whatever the founder was doing.
 *
 * Previously this navigated to /pricing, which cost them their draft and their
 * place. Checkout starts from here instead, so the only thing that leaves the
 * page is the trip to Stripe.
 */
export default function PaywallModal({
  isOpen,
  onClose,
  feature,
  hadTrial,
}: PaywallModalProps) {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Escape closes, matching every other modal in the app.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function startCheckout(plan: Plan) {
    setLoadingPlan(plan);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError(data?.error || "Could not start checkout. Please try again.");
    } catch {
      setError("Could not start checkout. Please try again.");
    }
    setLoadingPlan(null);
  }

  const busy = loadingPlan !== null;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade your plan"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: 28,
          maxWidth: 560,
          width: "100%",
          position: "relative",
          margin: "auto",
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "var(--accent)",
            borderRadius: "12px 12px 0 0",
          }}
        />

        <button
          onClick={onClose}
          aria-label="close"
          className="font-mono"
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            background: "transparent",
            border: "none",
            color: "var(--text-disabled)",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <p
          className="font-mono uppercase"
          style={{
            fontSize: 10,
            color: "var(--accent)",
            letterSpacing: "0.12em",
            marginBottom: 10,
          }}
        >
          // upgrade your plan
        </p>

        <h2
          className="font-sans"
          style={{
            fontSize: 22,
            color: "var(--text-primary)",
            marginBottom: 6,
            lineHeight: 1.25,
          }}
        >
          Upgrade your plan to keep going
        </h2>

        <p
          className="font-sans"
          style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}
        >
          {FEATURE_LINE[feature]}
        </p>

        {hadTrial && (
          <p
            className="font-mono"
            style={{ fontSize: 10, color: "var(--text-disabled)", marginBottom: 4 }}
          >
            // your trial has ended — pick a plan to pick up where you left off
          </p>
        )}

        {/* What Member is */}
        <div
          style={{
            background: "var(--bg-base)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            padding: 16,
            margin: "18px 0",
          }}
        >
          <p
            className="font-mono uppercase"
            style={{
              fontSize: 9,
              color: "var(--accent)",
              letterSpacing: "0.1em",
              marginBottom: 10,
            }}
          >
            what you get
          </p>
          {INCLUDED.map((item) => (
            <div
              key={item}
              style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 7 }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#22c55e",
                  flexShrink: 0,
                  marginTop: 6,
                }}
              />
              <span
                className="font-sans"
                style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45 }}
              >
                {item}
              </span>
            </div>
          ))}
        </div>

        {/* Plan choice — same keys the pricing page uses, resolved to a price
            server-side by lib/plans.ts. */}
        <div className="paywall-plans" style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => startCheckout("member")}
            disabled={busy}
            className="font-mono"
            style={{
              flex: 2,
              padding: "14px 16px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, rgba(245,158,11,.92), rgba(245,158,11,.72))",
              color: "#1a1204",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.04em",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {loadingPlan === "member"
              ? "Loading..."
              : `Become a Member — $${PRICING.member.monthly}/mo →`}
          </button>
          <button
            onClick={() => startCheckout("founding")}
            disabled={busy}
            className="font-mono"
            style={{
              flex: 1,
              padding: "14px 16px",
              borderRadius: 10,
              background: "transparent",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
              fontSize: 12,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
            title={`Founding rate — first ${FOUNDING_SEATS} members, locked for life`}
          >
            {loadingPlan === "founding"
              ? "Loading..."
              : `Founding — $${PRICING.founding.monthly}/mo`}
          </button>
        </div>

        <button
          onClick={() => startCheckout("member_annual")}
          disabled={busy}
          className="font-mono"
          style={{
            display: "block",
            width: "100%",
            marginTop: 10,
            background: "transparent",
            border: "none",
            padding: 0,
            fontSize: 11,
            color: "var(--accent)",
            cursor: busy ? "default" : "pointer",
            textAlign: "center",
          }}
        >
          {loadingPlan === "member_annual"
            ? "Loading..."
            : `or $${PRICING.member.annual}/year — 2 months free →`}
        </button>

        {error && (
          <p
            className="font-mono"
            style={{ fontSize: 11, color: "#f85149", marginTop: 12, textAlign: "center" }}
          >
            {error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            marginTop: 18,
          }}
        >
          <button
            onClick={() => {
              router.push("/pricing");
              onClose();
            }}
            className="font-mono"
            style={{
              background: "transparent",
              border: "none",
              fontSize: 11,
              color: "var(--text-disabled)",
              cursor: "pointer",
            }}
          >
            Compare plans →
          </button>
          <button
            onClick={onClose}
            className="font-mono"
            style={{
              background: "transparent",
              border: "none",
              fontSize: 11,
              color: "var(--text-disabled)",
              cursor: "pointer",
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
