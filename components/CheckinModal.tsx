"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Rating = "solid" | "mixed" | "rough" | "lost";
const RATINGS: { value: Rating; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "mixed", label: "Mixed" },
  { value: "rough", label: "Rough" },
  { value: "lost", label: "Lost" },
];

const QUESTION: React.CSSProperties = { fontSize: 15, lineHeight: 1.45, color: "var(--text-primary)" };

export default function CheckinModal({
  open,
  onClose,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
}) {
  const [step, setStep] = useState(0);
  const [decision, setDecision] = useState("");
  const [anon, setAnon] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);
  const [blocker, setBlocker] = useState("");
  const [win, setWin] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const TOTAL = 4;

  function reset() {
    setStep(0);
    setDecision("");
    setAnon(false);
    setRating(null);
    setBlocker("");
    setWin("");
    setBusy(false);
    setDone(false);
    setErr(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.from("check_ins").insert({
      user_id: userId,
      decision: decision.trim() || null,
      last_week_rating: rating,
      blocker: blocker.trim() || null,
      weekly_win: win.trim() || null,
      is_anonymous: anon,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDone(true);
  }

  if (!open) return null;

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      onClick={close}
    >
      <div
        role="dialog"
        aria-label="Weekly check-in"
        className="modal-shell w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell-head">
          <div className="min-w-0">
            <p className="modal-kicker">Weekly check-in</p>
            <h2 className="modal-title">{done ? "Check-in logged" : "A few honest minutes"}</h2>
            {!done && (
              <div className="flex items-center gap-2 mt-2.5">
                {Array.from({ length: TOTAL }).map((_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    style={{
                      width: i === step ? 20 : 8,
                      height: 4,
                      borderRadius: 999,
                      background: i <= step ? "#f59e0b" : "rgba(255, 255, 255, 0.12)",
                      transition: "all 200ms ease",
                    }}
                  />
                ))}
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>
                  Step {step + 1} of {TOTAL}
                </span>
              </div>
            )}
          </div>
          <button type="button" onClick={close} className="modal-close-btn">
            Esc
          </button>
        </div>

        {done ? (
          <>
            {/* This used to show "what two of your cohort members shared this
                week": two invented founders with made-up wins. Now it says what
                actually happens to the check-in. */}
            <div className="modal-shell-body">
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                Your cohort sees it with this week&apos;s check-ins in your room
                {anon ? ", without your name" : ""}. See you next week.
              </p>
            </div>
            <div className="modal-shell-foot">
              <button type="button" onClick={close} className="btn-primary">
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-shell-body">
              {step === 0 && (
                <div className="space-y-3">
                  <p style={QUESTION}>What&apos;s the biggest business decision you&apos;re facing right now?</p>
                  <textarea
                    rows={4}
                    aria-label="The decision"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    placeholder="The decision…"
                    autoFocus
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={anon}
                      aria-label="Share anonymously"
                      onClick={() => setAnon((v) => !v)}
                      className="relative shrink-0"
                      style={{
                        width: 34,
                        height: 20,
                        padding: 0,
                        border: "none",
                        borderRadius: 9999,
                        background: anon ? "#f59e0b" : "rgba(255, 255, 255, 0.12)",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 3,
                          left: anon ? 17 : 3,
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: anon ? "#1a1204" : "#fff",
                          transition: "left 150ms ease",
                        }}
                      />
                    </button>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Share anonymously</p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-3">
                  <p style={QUESTION}>How did last week actually go?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {RATINGS.map((r) => {
                      const active = rating === r.value;
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setRating(r.value)}
                          aria-pressed={active}
                          className="option-card py-3"
                          style={{
                            textAlign: "center",
                            fontSize: 14,
                            borderColor: active ? "rgba(245, 158, 11, 0.5)" : undefined,
                            color: active ? "#f8c56a" : "var(--text-secondary)",
                            background: active ? "rgba(245, 158, 11, 0.08)" : undefined,
                          }}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <p style={QUESTION}>What&apos;s your biggest blocker right now?</p>
                  <textarea
                    rows={4}
                    aria-label="The blocker"
                    value={blocker}
                    onChange={(e) => setBlocker(e.target.value)}
                    placeholder="The blocker…"
                    autoFocus
                  />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <p style={QUESTION}>What would make this week a win?</p>
                  <textarea
                    rows={4}
                    aria-label="This week's win"
                    value={win}
                    onChange={(e) => setWin(e.target.value)}
                    placeholder="The win…"
                    autoFocus
                  />
                </div>
              )}

              {err && <p style={{ fontSize: 13, color: "#f87171" }}>{err}</p>}
            </div>

            <div className="modal-shell-foot" style={{ justifyContent: "space-between" }}>
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || busy}
                className="btn-ghost disabled:opacity-30"
              >
                ← Back
              </button>
              {step < TOTAL - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={
                    (step === 0 && !decision.trim()) ||
                    (step === 1 && !rating) ||
                    (step === 2 && !blocker.trim())
                  }
                  className="btn-primary"
                >
                  Continue
                </button>
              ) : (
                <button type="button" onClick={submit} disabled={!win.trim() || busy} className="btn-primary">
                  {busy ? "Submitting…" : "Submit"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
