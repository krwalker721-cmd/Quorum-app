"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTier } from "@/contexts/TierContext";

const DISMISS_KEY = "quorum_welcome_dismissed";

// First-visit trial welcome card. Shows only during an active trial, within the
// first 24 hours of the subscription, and never again once dismissed.
export default function HomeWelcomeCard() {
  const router = useRouter();
  const { status, daysLeftInTrial, subscriptionCreatedAt, isLoading } = useTier();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (isLoading || dismissed) return null;
  if (status !== "trialing") return null;
  if (!subscriptionCreatedAt) return null;

  // Only within the first 24 hours of the trial.
  const createdMs = new Date(subscriptionCreatedAt).getTime();
  if (Number.isNaN(createdMs)) return null;
  if (Date.now() - createdMs > 24 * 60 * 60 * 1000) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {}
    setDismissed(true);
  }

  return (
    <div
      style={{
        position: "relative",
        background: "rgba(245,158,11,0.04)",
        border: "1px solid rgba(245,158,11,0.15)",
        borderRadius: 4,
        padding: "16px 20px",
        margin: "0 28px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div>
        <p
          className="font-mono"
          style={{ fontSize: 9, color: "#f59e0b", marginBottom: 4, letterSpacing: "0.05em" }}
        >
          // welcome to quorum
        </p>
        <p
          className="font-sans"
          style={{ fontSize: 13, color: "#8b949e" }}
        >
          Your {daysLeftInTrial ?? 30}-day trial is active. Explore everything — no limits.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
          paddingRight: 12,
        }}
      >
        <span className="font-mono" style={{ fontSize: 11, color: "#f59e0b" }}>
          {daysLeftInTrial ?? 0} days left
        </span>
        <button
          type="button"
          onClick={() => router.push("/pricing")}
          className="font-mono"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 10,
            color: "#484f58",
            padding: 0,
          }}
        >
          upgrade →
        </button>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="dismiss"
        style={{
          position: "absolute",
          top: 8,
          right: 10,
          background: "transparent",
          border: "none",
          color: "var(--text-disabled, #484f58)",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
