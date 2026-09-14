"use client";

import { useState } from "react";
import ui from "@/components/ui/sleek.module.css";

const ITEMS = [
  { glyph: "✦", key: "warm_intro", label: "Warm intro", body: "Send a warm intro to a cohort member who'd benefit from someone in your network." },
  { glyph: "◈", key: "handshake", label: "Handshake", body: "Agree to a recurring check-in with a cohort member: a structured commitment." },
  { glyph: "◉", key: "vouch", label: "Vouch", body: "Publicly vouch for a cohort member. It adds to their trust score." },
];

export default function FounderAgreements() {
  const [open, setOpen] = useState<string | null>(null);
  const active = ITEMS.find((i) => i.key === open);
  return (
    <div className="px-3 py-4 border-t" style={{ borderColor: "var(--border-default)" }}>
      <p className={ui.sideMeta} style={{ padding: "0 8px", marginBottom: 6 }}>
        Founder agreements
      </p>
      <div>
        {ITEMS.map((i) => (
          <button
            key={i.key}
            onClick={() => setOpen(i.key)}
            className={`${ui.navItem} w-full text-left`}
            style={{ padding: "7px 8px", fontSize: 13 }}
          >
            <span className="text-amber" style={{ fontSize: 13 }}>{i.glyph}</span>
            <span>{i.label}</span>
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setOpen(null)}
        >
          <div
            className={`${ui.tile} w-full max-w-sm`}
            style={{ padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber" style={{ fontSize: 16 }}>{active.glyph}</span>
              <p className="text-text-primary" style={{ fontSize: 15, fontWeight: 600 }}>{active.label}</p>
            </div>
            <p className="text-text-secondary" style={{ fontSize: 14, lineHeight: 1.6 }}>{active.body}</p>
            <div className="flex justify-end mt-5">
              <button onClick={() => setOpen(null)} className={ui.ghostBtn}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
