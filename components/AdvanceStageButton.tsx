"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAGE_COLOR } from "@/lib/stage";
import ui from "@/components/ui/sleek.module.css";

const ORDER = ["idea", "pre-seed", "seed", "series_a"] as const;
type Stage = (typeof ORDER)[number];

const STAGE_LABEL: Record<Stage, string> = {
  idea: "Idea",
  "pre-seed": "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
};

function nextStage(s: Stage): Stage | null {
  const i = ORDER.indexOf(s);
  if (i < 0 || i >= ORDER.length - 1) return null;
  return ORDER[i + 1];
}

function StageSwatch({ stage, dim = false }: { stage: Stage; dim?: boolean }) {
  const color = STAGE_COLOR[stage] ?? "#6e7681";
  return (
    <span
      style={{
        fontSize: 14,
        padding: "6px 14px",
        borderRadius: 999,
        border: `1px solid ${color}`,
        color: dim ? "var(--text-muted)" : color,
        background: dim ? "transparent" : `${color}1a`,
        opacity: dim ? 0.6 : 1,
        boxShadow: dim ? undefined : `0 0 16px ${color}40`,
      }}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}

export default function AdvanceStageButton({ currentStage }: { currentStage: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!currentStage || !ORDER.includes(currentStage as Stage)) return null;
  const cur = currentStage as Stage;
  const next = nextStage(cur);
  if (!next) return null; // already at series_a

  async function confirm() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/profile/advance-stage", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Couldn't advance your stage.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={ui.softBtn}
        style={{ padding: "4px 10px", fontSize: 12 }}
      >
        Advance stage
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Advance your stage"
            className="w-full max-w-md p-6 space-y-5"
            style={{
              background: "var(--card-elev)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 14,
              boxShadow: "0 24px 60px -20px rgba(0, 0, 0, 0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Advance your stage</p>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                className={ui.textBtn}
                style={{ fontSize: 13 }}
              >
                Close
              </button>
            </div>

            <div className="flex items-center gap-3 justify-center py-2">
              <StageSwatch stage={cur} dim />
              <span aria-hidden style={{ color: "var(--text-muted)" }}>→</span>
              <StageSwatch stage={next} />
            </div>

            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)", textAlign: "center" }}>
              This is permanent, so make sure you&apos;re ready.
            </p>

            {err && <p style={{ fontSize: 13, color: "#f87171" }}>{err}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className={ui.ghostBtn}>
                Not yet
              </button>
              <button type="button" onClick={confirm} disabled={busy} className={ui.primaryBtn}>
                {busy ? "Advancing…" : `Advance to ${STAGE_LABEL[next]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
