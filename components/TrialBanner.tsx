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

  // Only show when the trial is expired (edge case) or ending within 3 days.
  if (!expired && daysLeft > 3) return null;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore storage failures
    }
  }

  const accent = expired ? "#f85149" : "#f59e0b";
  const bg = expired ? "rgba(248,81,73,0.06)" : "rgba(245,158,11,0.06)";
  const border = expired
    ? "1px solid rgba(248,81,73,0.2)"
    : "1px solid rgba(245,158,11,0.2)";
  const leftText = expired
    ? "// your trial has ended — you're now on the free tier"
    : `// your trial ends in ${daysLeft} ${daysLeft === 1 ? "day" : "days"} — upgrade to keep full access`;
  const ctaText = expired ? "Upgrade to Member →" : "Upgrade now →";

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
