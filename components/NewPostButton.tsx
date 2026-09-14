"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ROOM_TYPE_COLOR, ROOM_TYPE_LABEL } from "@/lib/stage";
import { usePaywall } from "@/hooks/usePaywall";
import PaywallModal from "@/components/PaywallModal";
import Avatar from "@/components/Avatar";
import ui from "@/components/ui/sleek.module.css";
import { onOpenComposer, reportPosted } from "@/lib/tour-bus";

const TAGS = ["decision", "mindset", "hiring", "growth", "real_talk", "ops", "fundraising"];
const ROOM_TYPES = ["question", "update", "decision", "win", "blocker"] as const;

// "real_talk" → "Real talk"
function sentence(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function NewPostButton({
  userId,
  defaultPostType = "cohort",
  variant = "button",
  currentUserName,
}: {
  userId: string;
  defaultPostType?: "cohort" | "pulse";
  // "button" = the topbar pill; "composer" = the wide feed composer pill.
  variant?: "button" | "composer";
  currentUserName?: string | null;
}) {
  const router = useRouter();
  const { paywallState, checkAndGate, handleGateResponse, closePaywall } = usePaywall();
  const isPulse = defaultPostType === "pulse";
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("decision");
  const [roomType, setRoomType] = useState<(typeof ROOM_TYPES)[number]>("question");
  const [postType, setPostType] = useState<"cohort" | "pulse">(defaultPostType);
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Cohort membership — null while loading, [] when in no cohorts.
  const [myCohortIds, setMyCohortIds] = useState<string[] | null>(null);
  const inNoCohort = myCohortIds !== null && myCohortIds.length === 0;

  // On modal open, check whether the user belongs to any cohort. If not, the
  // cohort destination is disabled and we force the post to pulse.
  useEffect(() => {
    if (!open || myCohortIds !== null) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("cohort_members")
        .select("cohort_id")
        .eq("user_id", userId);
      if (cancelled) return;
      const ids = (data ?? []).map((r) => r.cohort_id).filter(Boolean) as string[];
      setMyCohortIds(ids);
      if (ids.length === 0) setPostType("pulse");
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId, myCohortIds]);

  // The guided tour can open this composer with a sentence starter already in
  // the field. Only the wide feed composer answers, so the TopBar's copy of this
  // button doesn't open a second modal on the same page.
  useEffect(() => {
    if (variant !== "composer" || !isPulse) return;
    return onOpenComposer("pulse-post", (text) => {
      setContent(text);
      setPostType("pulse");
      setOpen(true);
    });
  }, [variant, isPulse]);

  async function submit() {
    if (!content.trim()) return;
    // Guard: cohort posts require membership (mirrors the server-side RLS).
    if (postType === "cohort" && (myCohortIds?.length ?? 0) === 0) {
      setErr("Join a cohort to post there.");
      return;
    }
    // Paywall gate — check the cap before we attempt the insert.
    const feature = postType === "pulse" ? "pulse_posts" : "cohort_posts";
    const allowed = await checkAndGate(feature);
    if (!allowed) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setErr(null);
    const payload: Record<string, any> = {
      author_id: userId,
      content: content.trim(),
      post_type: postType,
      is_anonymous: anon,
      local_hour: new Date().getHours(),
    };
    if (postType === "pulse") {
      payload.room_type = roomType;
      payload.tag = null;
    } else {
      payload.tag = tag;
      // Attach to the user's (first) cohort so it lands in a real cohort room.
      payload.cohort_id = myCohortIds?.[0] ?? null;
    }
    // Server route enforces the cap and increments usage after the insert.
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // An entitlement 403 gets the upgrade overlay, not an inline error.
      if (handleGateResponse(feature, data)) {
        setOpen(false);
        return;
      }
      setErr(data.error || "Couldn't post that. Try again.");
      return;
    }
    if (anon) {
      fetch("/api/recognition/anonymous-post", { method: "POST" }).catch(() => {});
    }
    // Let a waiting tour step know the post actually landed.
    reportPosted(postType === "pulse" ? "pulse-post" : "cohort-post");
    setContent("");
    setAnon(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {variant === "composer" ? (
        // Only Pulse renders the composer, so it takes the sleek finish directly.
        <button onClick={() => setOpen(true)} className={ui.composer}>
          <Avatar name={currentUserName ?? null} size={30} />
          <span style={{ flex: 1, fontSize: 14, color: "var(--text-muted)" }}>
            Share what you&apos;re working through…
          </span>
          <span
            className={ui.glow}
            style={{
              fontSize: 13,
              fontWeight: 500,
              background: "linear-gradient(135deg, rgba(245,158,11,.95), rgba(245,158,11,.75))",
              color: "#1a1204",
              padding: "8px 16px",
              borderRadius: 8,
            }}
          >
            Post
          </span>
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-primary">
          {isPulse ? "+ post to pulse" : "+ post"}
        </button>
      )}

      {open && (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            role="dialog"
            aria-label={isPulse ? "Post to the community" : "New post"}
            className="modal-shell w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-shell-head">
              <div className="min-w-0">
                <p className="modal-kicker">{isPulse ? "Pulse" : "New post"}</p>
                <h2 className="modal-title">
                  {isPulse ? "Post to the community" : "What's on your mind?"}
                </h2>
                {isPulse && (
                  <p className="modal-subtitle">
                    This goes to every founder on Quorum. Make it worth their attention.
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="modal-close-btn">
                Esc
              </button>
            </div>

            <div className="modal-shell-body">
              <textarea
                rows={5}
                aria-label="Your post"
                placeholder={isPulse ? "Say something real…" : "What's on your mind?"}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                autoFocus
              />

              {isPulse ? (
                <div>
                  <label>Type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {ROOM_TYPES.map((t) => {
                      const active = roomType === t;
                      const color = ROOM_TYPE_COLOR[t] ?? "#f59e0b";
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setRoomType(t)}
                          aria-pressed={active}
                          className="option-card"
                          style={{
                            minHeight: 44,
                            padding: "9px 13px",
                            borderColor: active ? color : undefined,
                            background: active ? `${color}11` : undefined,
                          }}
                        >
                          <p style={{ fontSize: 14, color: active ? color : "var(--text-primary)" }}>
                            {sentence(t)}
                          </p>
                          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                            {sentence(ROOM_TYPE_LABEL[t] ?? "")}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <label>Tag</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {TAGS.map((t) => {
                      const active = tag === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTag(t)}
                          aria-pressed={active}
                          className={`option-chip${active ? " selected" : ""}`}
                        >
                          {sentence(t)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Destination selector — hidden when locked to pulse */}
              {!isPulse && (
                <div>
                  <label>Post to</label>
                  <div className="flex gap-2 mt-1">
                    {(["cohort", "pulse"] as const).map((d) => {
                      const active = postType === d;
                      const disabled = d === "cohort" && inNoCohort;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => !disabled && setPostType(d)}
                          disabled={disabled}
                          aria-pressed={active}
                          title={disabled ? "Join a cohort to post there" : undefined}
                          className={`option-chip flex-1${active ? " selected" : ""}`}
                          style={{
                            borderRadius: 10,
                            padding: "8px 12px",
                            opacity: disabled ? 0.35 : 1,
                            cursor: disabled ? "not-allowed" : "pointer",
                          }}
                        >
                          {d === "cohort" ? "Your cohort" : "Pulse"}
                        </button>
                      );
                    })}
                  </div>
                  {inNoCohort && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                      Join a cohort to post there.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="switch"
                  onClick={() => setAnon((v) => !v)}
                  aria-checked={anon}
                  aria-label="Post anonymously"
                  className="relative shrink-0"
                  style={{
                    flex: "0 0 34px",
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
                <div style={{ flex: "1 1 auto", minWidth: 0, lineHeight: 1.4 }}>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Post anonymously</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {isPulse || postType === "pulse"
                      ? "The community sees your words, not your name."
                      : "Your cohort sees the post but not your name."}
                  </p>
                </div>
              </div>

              {err && <p style={{ fontSize: 13, color: "#f87171" }}>{err}</p>}
            </div>

            <div className="modal-shell-foot">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost" disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !content.trim()}
                className="btn-primary"
              >
                {busy ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {paywallState.isOpen && (
        <PaywallModal
          isOpen={paywallState.isOpen}
          onClose={closePaywall}
          feature={paywallState.feature!}
          hadTrial={paywallState.hadTrial}
        />
      )}
    </>
  );
}
