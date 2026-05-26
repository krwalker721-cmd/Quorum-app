"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STAGE_COLOR } from "@/lib/stage";

const ORDER = ["idea", "pre-seed", "seed", "series_a"] as const;
type Stage = (typeof ORDER)[number];

function nextStage(s: Stage): Stage | null {
  const i = ORDER.indexOf(s);
  if (i < 0 || i >= ORDER.length - 1) return null;
  return ORDER[i + 1];
}

function StagePillSwatch({
  stage,
  dim = false,
  glow = false,
}: {
  stage: Stage;
  dim?: boolean;
  glow?: boolean;
}) {
  const color = STAGE_COLOR[stage] ?? "#6e7681";
  return (
    <span
      className="font-mono lowercase text-[0.75rem] px-3 py-1.5 inline-flex items-center"
      style={{
        border: `1px solid ${color}`,
        color: dim ? "rgba(255,255,255,0.45)" : color,
        background: dim ? "transparent" : `${color}14`,
        opacity: dim ? 0.55 : 1,
        boxShadow: glow ? `0 0 14px ${color}55, 0 0 4px ${color}33` : undefined,
      }}
    >
      {stage}
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
      setErr(data.error ?? "could not advance");
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
        className="font-mono lowercase text-[0.7rem] px-2.5 py-1 transition-colors"
        style={{
          border: "1px solid rgba(245, 158, 11,0.4)",
          color: "#f59e0b",
          background: "transparent",
        }}
      >
        advance stage â†’
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md border p-6 space-y-5"
            style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-mono lowercase text-xs text-text-muted">
                advance stage
              </p>
              <button
                onClick={() => !busy && setOpen(false)}
                className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-primary"
              >
                close
              </button>
            </div>

            <div className="flex items-center gap-3 justify-center py-2">
              <StagePillSwatch stage={cur} dim />
              <span className="font-mono text-text-faint">â†’</span>
              <StagePillSwatch stage={next} glow />
            </div>

            <p className="font-mono lowercase text-[0.7rem] text-text-muted text-center leading-relaxed">
              advancing your stage is permanent â€” make sure you&apos;re ready
            </p>

            {err && (
              <p className="font-mono text-xs text-red-400 lowercase">{err}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="font-mono lowercase text-xs px-4 py-2 border disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                not yet
              </button>
              <button
                onClick={confirm}
                disabled={busy}
                className="btn-primary"
              >
                {busy ? "..." : `advance to ${next} â†’`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
