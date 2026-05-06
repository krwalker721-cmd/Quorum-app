"use client";

import { useState } from "react";

const ITEMS = [
  { glyph: "✦", key: "warm_intro", label: "warm intro", body: "send a warm intro to a cohort member who'd benefit from someone in your network." },
  { glyph: "◈", key: "handshake", label: "handshake", body: "agree to a recurring check-in with a cohort member — a structured commitment." },
  { glyph: "◉", key: "vouch", label: "vouch", body: "publicly vouch for a cohort member — adds to their trust_score." },
];

export default function FounderAgreements() {
  const [open, setOpen] = useState<string | null>(null);
  const active = ITEMS.find((i) => i.key === open);
  return (
    <div className="px-3 py-4 border-t" style={{ borderColor: "var(--border)" }}>
      <p className="font-mono lowercase text-[0.65rem] text-text-faint px-1 mb-2">founder_agreements</p>
      <div className="space-y-1">
        {ITEMS.map((i) => (
          <button
            key={i.key}
            onClick={() => setOpen(i.key)}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-white/5"
          >
            <span className="text-amber text-sm">{i.glyph}</span>
            <span className="font-mono lowercase text-[0.7rem] text-text-muted">{i.label}</span>
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
            className="w-full max-w-sm border p-6"
            style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber text-lg">{active.glyph}</span>
              <p className="font-mono lowercase text-text-secondary text-sm">{active.label}</p>
            </div>
            <p className="text-text-muted text-[0.85rem] leading-relaxed">{active.body}</p>
            <div className="flex justify-end mt-5">
              <button
                onClick={() => setOpen(null)}
                className="font-mono lowercase text-[0.7rem] px-3 py-1.5 border"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
