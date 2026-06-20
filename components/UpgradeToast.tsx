"use client";

import { useEffect, useState } from "react";
import { useTier } from "@/contexts/TierContext";

// Reads the post-checkout query flags (?upgraded=true / ?trial=activated) on the
// home page and shows a self-dismissing success banner. Uses window.location so
// it needs no Suspense boundary.
export default function UpgradeToast() {
  const { refresh } = useTier();
  const [message, setMessage] = useState<string | null>(null);
  // Secondary line connecting the upgrade moment to the referral flow — shown a
  // couple seconds after a successful upgrade.
  const [secondary, setSecondary] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let msg: string | null = null;
    const upgraded = params.get("upgraded") === "true";
    if (upgraded) {
      msg = "// welcome to Member — full access unlocked";
    } else if (params.get("trial") === "activated") {
      msg = "// your free month is active — you won't be charged until day 31";
    }
    if (!msg) return;

    setMessage(msg);

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Tier just changed — refresh the shared context so pills and nudges across
    // the app update immediately without a page reload, then surface a referral
    // nudge a couple seconds later.
    if (upgraded) {
      refresh();
      timers.push(
        setTimeout(
          () =>
            setSecondary(
              "Your referral link unlocks after you complete your profile, return 3 days, and post on pulse.",
            ),
          2000,
        ),
      );
    }

    // Strip the flag from the URL so a refresh doesn't re-show the banner.
    params.delete("upgraded");
    params.delete("trial");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (qs ? `?${qs}` : ""),
    );

    timers.push(
      setTimeout(() => {
        setMessage(null);
        setSecondary(null);
      }, upgraded ? 8000 : 5000),
    );
    return () => timers.forEach(clearTimeout);
  }, [refresh]);

  if (!message) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        className="font-mono"
        style={{
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 4,
          padding: "12px 20px",
          fontSize: 12,
          color: "#22c55e",
          letterSpacing: "0.05em",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span>{message}</span>
        <button
          onClick={() => {
            setMessage(null);
            setSecondary(null);
          }}
          aria-label="dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-disabled)",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      {secondary && (
        <p
          className="font-mono"
          style={{
            fontSize: 10,
            color: "#484f58",
            letterSpacing: "0.05em",
            maxWidth: 420,
            textAlign: "center",
          }}
        >
          {secondary}
        </p>
      )}
    </div>
  );
}
