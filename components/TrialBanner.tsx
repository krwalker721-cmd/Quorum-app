"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface TrialBannerProps {
  trialEndsAt: string | null;
  tier: "free" | "member" | "partner";
  status: string;
}

const DISMISS_KEY = "quorum:trial_banner_dismissed";

export default function TrialBanner({
  trialEndsAt,
  tier,
  status,
}: TrialBannerProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [ctaHover, setCtaHover] = useState(false);
  const [closeHover, setCloseHover] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      // ignore storage failures
    }
  }, []);

  // Never show for paid tiers or outside an active trial.
  if (tier === "member" || tier === "partner") return null;
  if (status !== "trialing") return null;
  if (!trialEndsAt) return null;
  if (dismissed) return null;

  const end = new Date(trialEndsAt).getTime();
  const now = Date.now();
  const msLeft = end - now;
  const daysLeft = Math.ceil(msLeft / 86_400_000);
  const expired = msLeft <= 0;

  // Shown for the whole trial, not just the last few days — a founder should be
  // able to see at a glance that the trial is running and how long is left.
  // Urgency (and the red treatment) only kicks in near the end.

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore storage failures
    }
  }

  const ending = !expired && daysLeft <= 3;
  const accent = expired ? "#f85149" : ending ? "#f59e0b" : "#22c55e";
  const bg = expired
    ? "rgba(248,81,73,0.06)"
    : ending
      ? "rgba(245,158,11,0.06)"
      : "rgba(34,197,94,0.05)";
  const border = expired
    ? "1px solid rgba(248,81,73,0.2)"
    : ending
      ? "1px solid rgba(245,158,11,0.2)"
      : "1px solid rgba(34,197,94,0.16)";
  const dayWord = daysLeft === 1 ? "day" : "days";
  const leftText = expired
    ? "// your trial has ended — you're now on the free tier"
    : ending
      ? `// your trial ends in ${daysLeft} ${dayWord} — add a card to keep full access`
      : `// trial active — full member access for ${daysLeft} more ${dayWord}`;
  const ctaText = expired ? "Upgrade to Member →" : ending ? "Keep my access →" : "See plans →";

  return (
    <div
      style={{
        background: bg,
        borderBottom: border,
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
          fontSize: 11,
          color: accent,
        }}
      >
        {leftText}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={() => router.push("/pricing")}
          onMouseEnter={() => setCtaHover(true)}
          onMouseLeave={() => setCtaHover(false)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            fontSize: 11,
            color: accent,
            textDecoration: ctaHover ? "underline" : "none",
          }}
        >
          {ctaText}
        </button>
        <button
          onClick={dismiss}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          aria-label="dismiss"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
            color: closeHover ? "#8b949e" : "#484f58",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
