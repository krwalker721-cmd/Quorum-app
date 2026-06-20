"use client";

import { useState } from "react";
import { useTier } from "@/contexts/TierContext";

// Always-visible Partner teaser for the home right rail. Shows for every tier
// (including Member) to build aspiration. Lets the user join the waitlist.
export default function PartnerTeaserCard() {
  const { partnerWaitlist, isLoading } = useTier();
  const [joined, setJoined] = useState(false);
  const [saving, setSaving] = useState(false);

  const onWaitlist = partnerWaitlist || joined;

  async function join() {
    if (saving || onWaitlist) return;
    setSaving(true);
    try {
      const res = await fetch("/api/partner-waitlist", { method: "POST" });
      if (res.ok) setJoined(true);
    } catch {
      // ignore — user can retry
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return null;

  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid rgba(167,139,250,0.2)",
        borderLeft: "2px solid #a78bfa",
        borderRadius: "0 4px 4px 0",
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, color: "#a78bfa", letterSpacing: "0.1em" }}
        >
          // partner
        </span>
        <span className="font-mono" style={{ fontSize: 8, color: "#484f58" }}>
          coming soon
        </span>
      </div>

      <p
        className="font-sans"
        style={{
          fontSize: 12,
          color: "#6e7681",
          marginTop: 8,
          marginBottom: 12,
          lineHeight: 1.6,
        }}
      >
        A private room for founders already doing serious revenue. Deal flow,
        senior network, and introductions that move the needle.
      </p>

      {onWaitlist ? (
        <span
          className="font-mono"
          style={{ fontSize: 10, color: "#484f58", cursor: "default" }}
        >
          on the waitlist ✓
        </span>
      ) : (
        <button
          type="button"
          onClick={join}
          disabled={saving}
          className="font-mono"
          style={{
            background: "transparent",
            border: "none",
            cursor: saving ? "default" : "pointer",
            fontSize: 10,
            color: "#a78bfa",
            padding: 0,
            opacity: saving ? 0.6 : 1,
          }}
        >
          join the waitlist →
        </button>
      )}
    </div>
  );
}
