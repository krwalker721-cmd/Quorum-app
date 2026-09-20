"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePaywall } from "@/hooks/usePaywall";
import PaywallModal from "@/components/PaywallModal";
import { reportPosted } from "@/lib/tour-bus";

type RoomType = "question" | "update" | "decision" | "win" | "blocker";

const TYPES: { value: RoomType; label: string; color: string; desc: string }[] = [
  { value: "question", label: "Question", color: "#38bdf8", desc: "Needs input from the room" },
  { value: "update", label: "Update", color: "#8b949e", desc: "Here's where I'm at" },
  { value: "decision", label: "Decision", color: "#f59e0b", desc: "Deciding something, thoughts welcome" },
  { value: "win", label: "Win", color: "#22c55e", desc: "Something worked" },
  { value: "blocker", label: "Blocker", color: "#f85149", desc: "Stuck on something specific" },
];

export default function RoomPostModal({
  cohortId,
  initialContent = "",
  onClose,
}: {
  userId: string;
  cohortId: string;
  // Pre-typed opener, handed in by the guided tour's sentence starters.
  initialContent?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { paywallState, checkAndGate, handleGateResponse, closePaywall } = usePaywall();
  const [type, setType] = useState<RoomType>("update");
  const [content, setContent] = useState(initialContent);
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!content.trim()) return;
    // Paywall gate — cohort posts need full access.
    const allowed = await checkAndGate("cohort_posts");
    if (!allowed) return;
    setBusy(true);
    setErr(null);
    // Server route enforces the cap and increments usage after the insert.
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: content.trim(),
        post_type: "cohort",
        cohort_id: cohortId,
        room_type: type,
        is_anonymous: anon,
        local_hour: new Date().getHours(),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // An entitlement 403 gets the upgrade overlay, not an inline error.
      if (handleGateResponse("cohort_posts", data)) return;
      setErr(data.error || "Couldn't post that. Try again.");
      return;
    }
    if (anon) {
      fetch("/api/recognition/anonymous-post", { method: "POST" }).catch(() => {});
    }
    // Let a waiting tour step know the post actually landed.
    reportPosted("cohort-post");
    onClose();
    router.refresh();
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="New room post"
        className="modal-shell w-full max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell-head">
          <div className="min-w-0">
            <p className="modal-kicker">Cohort room</p>
            <h2 className="modal-title">New room post</h2>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn">
            Esc
          </button>
        </div>

        <div className="modal-shell-body">
          <div>
            <label>Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {TYPES.map((t) => {
                const active = type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    aria-pressed={active}
                    className="option-card px-3 py-2.5"
                    style={{
                      borderColor: active ? t.color : undefined,
                      background: active ? `${t.color}14` : undefined,
                    }}
                  >
                    <p style={{ fontSize: 13, color: active ? t.color : "var(--text-primary)" }}>{t.label}</p>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="room-post-content">What&apos;s happening?</label>
            <textarea
              id="room-post-content"
              rows={5}
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              onClick={() => setAnon((v) => !v)}
              aria-checked={anon}
              aria-label="Post anonymously"
              className="relative shrink-0"
              style={{
                width: 34,
                height: 20,
                padding: 0,
                border: "none",
                borderRadius: 9999,
                background: anon ? "#f59e0b" : "rgba(255, 255, 255, 0.12)",
                transition: "background 150ms ease",
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
            <div style={{ lineHeight: 1.4 }}>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Post anonymously</p>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                The room sees the post but not your name.
              </p>
            </div>
          </div>

          {err && <p style={{ fontSize: 12, color: "#f87171" }}>{err}</p>}
        </div>

        <div className="modal-shell-foot">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !content.trim()}
            className="btn-primary"
          >
            {busy ? "Posting…" : "Post to room"}
          </button>
        </div>
      </div>

      {paywallState.isOpen && (
        <PaywallModal
          isOpen={paywallState.isOpen}
          onClose={closePaywall}
          feature={paywallState.feature!}
          hadTrial={paywallState.hadTrial}
        />
      )}
    </div>
  );
}
