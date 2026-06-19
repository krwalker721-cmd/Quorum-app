"use client";

import { useEffect, useState } from "react";

// Reads the post-checkout query flags (?upgraded=true / ?trial=activated) on the
// home page and shows a self-dismissing success banner. Uses window.location so
// it needs no Suspense boundary.
export default function UpgradeToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let msg: string | null = null;
    if (params.get("upgraded") === "true") {
      msg = "// welcome to Member — full access unlocked";
    } else if (params.get("trial") === "activated") {
      msg = "// your free month is active — you won't be charged until day 31";
    }
    if (!msg) return;

    setMessage(msg);

    // Strip the flag from the URL so a refresh doesn't re-show the banner.
    params.delete("upgraded");
    params.delete("trial");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (qs ? `?${qs}` : ""),
    );

    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, []);

  if (!message) return null;

  return (
    <div
      className="font-mono"
      style={{
        position: "fixed",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(34,197,94,0.1)",
        border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: 4,
        padding: "12px 20px",
        zIndex: 1000,
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
        onClick={() => setMessage(null)}
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
  );
}
