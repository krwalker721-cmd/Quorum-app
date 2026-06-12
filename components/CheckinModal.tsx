"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Rating = "solid" | "mixed" | "rough" | "lost";
const RATINGS: Rating[] = ["solid", "mixed", "rough", "lost"];

const SAMPLE_PEER_CHECKINS = [
  {
    name: "kira oduya",
    stage: "pre-seed",
    rating: "mixed",
    win: "ship the onboarding rewrite and get one user through it cold.",
  },
  {
    name: "marcus hale",
    stage: "seed",
    rating: "solid",
    win: "finish founder calls for the next 8 inbound leads.",
  },
];

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
      setErr(error.message.toLowerCase());
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
        className="modal-shell w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell-head">
          <div className="min-w-0">
            <p className="modal-kicker">weekly_checkin</p>
            <h2 className="modal-title">
              {done ? "checkin logged " : "a few honest minutes"}
            </h2>
            {!done && (
              <div className="flex items-center gap-2 mt-2.5">
                {Array.from({ length: TOTAL }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: i === step ? 20 : 8,
                      height: 4,
                      borderRadius: 999,
                      background: i <= step ? "#f59e0b" : "var(--border)",
                      transition: "all 200ms ease",
                    }}
                  />
                ))}
                <span className="font-mono lowercase text-[0.6rem] text-text-faint ml-1">
                  {step + 1}/{TOTAL}
                </span>
              </div>
            )}
          </div>
          <button onClick={close} className="modal-close-btn">
            esc
          </button>
        </div>

        {done ? (
          <>
          <div className="modal-shell-body">
            <p className="text-text-secondary text-sm leading-relaxed">
              here&apos;s what two of your cohort members shared this week:
            </p>
            <div className="space-y-3">
              {SAMPLE_PEER_CHECKINS.map((c) => (
                <div
                  key={c.name}
                  className="p-3.5 border rounded-xl"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-mono lowercase text-[0.7rem] text-text-secondary">
                      {c.name} · {c.stage}
                    </p>
                    <span className="font-mono lowercase text-[0.6rem] text-amber">{c.rating}</span>
                  </div>
                  <p className="text-text-primary text-[0.85rem] mt-2 leading-snug">{c.win}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-shell-foot">
            <button
              onClick={close}
              className="btn-primary"
            >
              done
            </button>
          </div>
          </>
        ) : (
          <>
          <div className="modal-shell-body">
            {step === 0 && (
              <div className="space-y-3">
                <p className="text-text-primary text-[0.95rem]">
                  what&apos;s the biggest business decision you&apos;re facing right now?
                </p>
                <textarea
                  rows={4}
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  placeholder="the decision..."
                  autoFocus
                />
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setAnon((v) => !v)}
                    className="relative shrink-0"
                    style={{
                      width: 34,
                      height: 18,
                      borderRadius: 9999,
                      background: anon ? "#f59e0b" : "var(--border)",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: anon ? 18 : 2,
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: "#fff",
                        transition: "left 150ms ease",
                      }}
                    />
                  </button>
                  <p className="font-mono lowercase text-[0.7rem] text-text-muted">
                    share anonymously
                  </p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-text-primary text-[0.95rem]">how did last week actually go?</p>
                <div className="grid grid-cols-2 gap-2">
                  {RATINGS.map((r) => {
                    const active = rating === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setRating(r)}
                        className="option-card font-mono lowercase text-xs py-3"
                        style={{
                          textAlign: "center",
                          borderColor: active ? "#f59e0b" : undefined,
                          color: active ? "#f59e0b" : "var(--text-muted)",
                          background: active ? "rgba(245, 158, 11,0.08)" : undefined,
                        }}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-text-primary text-[0.95rem]">what&apos;s your biggest blocker right now?</p>
                <textarea
                  rows={4}
                  value={blocker}
                  onChange={(e) => setBlocker(e.target.value)}
                  placeholder="the blocker..."
                  autoFocus
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-text-primary text-[0.95rem]">what would make this week a win?</p>
                <textarea
                  rows={4}
                  value={win}
                  onChange={(e) => setWin(e.target.value)}
                  placeholder="the win..."
                  autoFocus
                />
              </div>
            )}

            {err && <p className="font-mono text-xs text-red-400 lowercase">{err}</p>}
          </div>

          <div className="modal-shell-foot" style={{ justifyContent: "space-between" }}>
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || busy}
              className="btn-ghost disabled:opacity-30"
            >
               back
            </button>
            {step < TOTAL - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={
                  (step === 0 && !decision.trim()) ||
                  (step === 1 && !rating) ||
                  (step === 2 && !blocker.trim())
                }
                className="btn-primary"
              >
                continue
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!win.trim() || busy}
                className="btn-primary"
              >
                {busy ? "..." : "submit "}
              </button>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
