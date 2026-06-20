"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  currentUsage?: number;
  limit?: number;
  hadTrial?: boolean;
}

// Per-feature copy. Heading shows on the modal, list is what Member unlocks.
const FEATURE_COPY: Record<
  PaywallFeature,
  { heading: string; unlocks: string[] }
> = {
  cohort_posts: {
    heading: "You've used your cohort posts for this month.",
    unlocks: [
      "Unlimited cohort posts",
      "Post decisions, wins, blockers",
      "Get real answers from your cohort",
    ],
  },
  pulse_posts: {
    heading: "You've used your pulse posts for this month.",
    unlocks: [
      "Unlimited pulse posts",
      "Share with the whole network",
      "Build your reputation",
    ],
  },
  replies: {
    heading: "You've used your replies for this month.",
    unlocks: [
      "Unlimited replies",
      "Engage with every post",
      "Build real relationships",
    ],
  },
  messages: {
    heading: "You've used your messages for this month.",
    unlocks: [
      "Unlimited messages",
      "DM any founder directly",
      "No monthly limits",
    ],
  },
  vault_notes: {
    heading: "You've reached your vault note limit.",
    unlocks: [
      "Unlimited vault notes",
      "Full Tiptap rich editor",
      "Organize everything",
    ],
  },
  collab_posts: {
    heading: "Collab board access is for Members only.",
    unlocks: [
      "Full collab board access",
      "Post projects and needs",
      "Find co-builders and hires",
    ],
  },
};

export default function PaywallModal({
  isOpen,
  onClose,
  feature,
  currentUsage,
  limit,
  hadTrial,
}: PaywallModalProps) {
  const router = useRouter();
  const [closeHover, setCloseHover] = useState(false);
  const [billingHover, setBillingHover] = useState(false);
  const [dismissHover, setDismissHover] = useState(false);

  if (!isOpen) return null;

  const copy = FEATURE_COPY[feature];
  const isCollab = feature === "collab_posts";

  function goToPricing() {
    router.push("/pricing");
    onClose();
  }

  async function manageBilling() {
    try {
      const res = await fetch("/api/subscription", { method: "POST" });
      const data = await res.json();
      if (data?.url) window.open(data.url, "_blank");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Billing portal failed:", err);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#161b22",
          border: "1px solid #21262d",
          borderRadius: 4,
          padding: 32,
          maxWidth: 440,
          width: "100%",
          position: "relative",
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
            background: "#f59e0b",
            borderRadius: "4px 4px 0 0",
          }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          aria-label="close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "transparent",
            border: "none",
            color: closeHover ? "#8b949e" : "#484f58",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {/* Lock icon */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>

        {/* Eyebrow */}
        <p
          style={{
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            fontSize: 10,
            color: "#f59e0b",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          // free tier limit reached
        </p>

        {/* Heading */}
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk, ui-sans-serif, system-ui)",
            fontSize: 20,
            color: "#e6edf3",
            textAlign: "center",
            marginBottom: 8,
            lineHeight: 1.25,
          }}
        >
          {copy.heading}
        </h2>

        {/* Usage line */}
        {!isCollab && (
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
              fontSize: 11,
              color: "#484f58",
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            {currentUsage ?? 0} / {limit ?? 0} used this month
          </p>
        )}
        {isCollab && (
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
              fontSize: 11,
              color: "#484f58",
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            member feature — upgrade to access
          </p>
        )}

        {/* What you're missing card */}
        <div
          style={{
            background: "#0d1117",
            border: "1px solid #21262d",
            borderRadius: 4,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
              fontSize: 9,
              color: "#f59e0b",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 10,
            }}
          >
            unlock with member
          </p>
          {copy.unlocks.map((item) => (
            <div
              key={item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22c55e",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-space-grotesk, ui-sans-serif, system-ui)",
                  fontSize: 13,
                  color: "#8b949e",
                }}
              >
                {item}
              </span>
            </div>
          ))}
        </div>

        {/* Trial awareness */}
        {hadTrial && (
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
              fontSize: 10,
              color: "#484f58",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            // your trial has ended — upgrade to keep the momentum going
          </p>
        )}

        {/* Primary CTA */}
        <button
          onClick={goToPricing}
          style={{
            background: "#f59e0b",
            color: "#0d1117",
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.06em",
            padding: 14,
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            width: "100%",
            marginBottom: 10,
          }}
        >
          Upgrade to Member — $49/month →
        </button>

        {/* Manage billing */}
        <button
          onClick={manageBilling}
          onMouseEnter={() => setBillingHover(true)}
          onMouseLeave={() => setBillingHover(false)}
          style={{
            display: "block",
            margin: "0 auto 4px",
            background: "transparent",
            border: "none",
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            fontSize: 11,
            color: billingHover ? "#8b949e" : "#484f58",
            cursor: "pointer",
          }}
        >
          Manage billing →
        </button>

        {/* Dismiss */}
        <button
          onClick={onClose}
          onMouseEnter={() => setDismissHover(true)}
          onMouseLeave={() => setDismissHover(false)}
          style={{
            display: "block",
            margin: "0 auto",
            background: "transparent",
            border: "none",
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            fontSize: 11,
            color: dismissHover ? "#8b949e" : "#484f58",
            cursor: "pointer",
          }}
        >
          stay on free →
        </button>
      </div>
    </div>
  );
}
