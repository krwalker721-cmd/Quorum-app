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

const SANS = "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif";

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
  const quietBtn: React.CSSProperties = {
    background: "transparent",
    border: "none",
    fontFamily: SANS,
    fontSize: 12,
    color: "var(--text-muted)",
    cursor: "pointer",
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Become a member"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(1, 4, 9, 0.72)",
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
          background:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0) 30%), var(--bg-elevated)",
          border: "1px solid rgba(255, 255, 255, 0.09)",
          borderRadius: 14,
          boxShadow: "0 30px 80px -30px rgba(0, 0, 0, 0.8)",
          padding: 28,
          maxWidth: 560,
          width: "100%",
          position: "relative",
          margin: "auto",
          fontFamily: SANS,
        }}
      >
        {/* The amber top edge, as on every dialog */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: "16%",
            right: "16%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.55), transparent)",
          }}
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <p style={{ fontSize: 12, fontWeight: 500, color: "#f8c56a", marginBottom: 8 }}>Membership</p>

        <h2
          style={{
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            marginBottom: 6,
            lineHeight: 1.25,
          }}
        >
          Become a member to keep going
        </h2>

        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
          {FEATURE_LINE[feature]}
        </p>

        {hadTrial && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
            Your trial has ended. Pick a plan to pick up where you left off.
          </p>
        )}

        {/* What Member is */}
        <div
          style={{
            background: "rgba(0, 0, 0, 0.2)",
            border: "1px solid rgba(255, 255, 255, 0.07)",
            borderRadius: 12,
            padding: 16,
            margin: "18px 0",
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 10 }}>
            What you get
          </p>
          {INCLUDED.map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 7 }}>
              <span
                aria-hidden
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#22c55e",
                  flexShrink: 0,
                  marginTop: 7,
                }}
              />
              <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45 }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Plan choice — same keys the pricing page uses, resolved to a price
            server-side by lib/plans.ts. */}
        <div className="paywall-plans" style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => startCheckout("member")}
            disabled={busy}
            style={{
              flex: 2,
              padding: "13px 16px",
              borderRadius: 10,
              border: "none",
              background: "var(--btn-primary-bg)",
              boxShadow: "var(--btn-primary-shadow)",
              color: "var(--btn-primary-fg)",
              fontFamily: SANS,
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {loadingPlan === "member" ? "Loading…" : `Become a member — $${PRICING.member.monthly}/mo →`}
          </button>
          <button
            type="button"
            onClick={() => startCheckout("founding")}
            disabled={busy}
            style={{
              flex: 1,
              padding: "13px 16px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.03)",
              color: "var(--text-primary)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              fontFamily: SANS,
              fontSize: 13,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
            title={`Founding rate — first ${FOUNDING_SEATS} members, locked for life`}
          >
            {loadingPlan === "founding" ? "Loading…" : `Founding — $${PRICING.founding.monthly}/mo`}
          </button>
        </div>

        <button
          type="button"
          onClick={() => startCheckout("member_annual")}
          disabled={busy}
          style={{
            display: "block",
            width: "100%",
            marginTop: 12,
            background: "transparent",
            border: "none",
            padding: 0,
            fontFamily: SANS,
            fontSize: 12,
            color: "#f8c56a",
            cursor: busy ? "default" : "pointer",
            textAlign: "center",
          }}
        >
          {loadingPlan === "member_annual"
            ? "Loading…"
            : `Or $${PRICING.member.annual}/year — 2 months free →`}
        </button>

        {error && (
          <p style={{ fontSize: 12, color: "#f87171", marginTop: 12, textAlign: "center" }}>{error}</p>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 18 }}>
          <button
            type="button"
            onClick={() => {
              router.push("/pricing");
              onClose();
            }}
            style={quietBtn}
          >
            Compare plans →
          </button>
          <button type="button" onClick={onClose} style={quietBtn}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
