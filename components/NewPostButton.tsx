"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ROOM_TYPE_COLOR, ROOM_TYPE_LABEL } from "@/lib/stage";
import { usePaywall } from "@/hooks/usePaywall";
import PaywallModal from "@/components/PaywallModal";

const TAGS = ["decision", "mindset", "hiring", "growth", "real_talk", "ops", "fundraising"];
const ROOM_TYPES = ["question", "update", "decision", "win", "blocker"] as const;

export default function NewPostButton({
  userId,
  defaultPostType = "cohort",
}: {
  userId: string;
  defaultPostType?: "cohort" | "pulse";
}) {
  const router = useRouter();
  const { paywallState, checkAndGate, closePaywall } = usePaywall();
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

  async function submit() {
    if (!content.trim()) return;
    // Guard: cohort posts require membership (mirrors the server-side RLS).
    if (postType === "cohort" && (myCohortIds?.length ?? 0) === 0) {
      setErr("join a cohort to post here.");
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
    const supabase = createClient();
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
    const { error } = await supabase.from("posts").insert(payload);
    setBusy(false);
    if (error) {
      setErr(error.message.toLowerCase());
      return;
    }
    if (anon) {
      fetch("/api/recognition/anonymous-post", { method: "POST" }).catch(() => {});
    }
    // Track usage after a successful post (free tier only — API no-ops for paid).
    fetch("/api/usage/increment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature: postType === "pulse" ? "pulse_posts" : "cohort_posts" }),
    }).catch(() => {});
    setContent("");
    setAnon(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        {isPulse ? "+ post to pulse" : "+ post"}
      </button>

      {open && (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="modal-shell w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-shell-head">
              <div className="min-w-0">
                <p className="modal-kicker">{isPulse ? "pulse" : "new post"}</p>
                <h2 className="modal-title">
                  {isPulse ? "post to the community" : "what's on your mind?"}
                </h2>
                {isPulse && (
                  <p className="modal-subtitle">
                    this goes to every founder on quorum. make it worth their attention.
                  </p>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="modal-close-btn">
                esc
              </button>
            </div>

            <div className="modal-shell-body">
              <textarea
                rows={5}
                placeholder={
                  isPulse
                    ? "say something real…"
                    : "what's on your mind?"
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
                autoFocus
              />

              {isPulse ? (
                <div>
                  <label>type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {ROOM_TYPES.map((t) => {
                      const active = roomType === t;
                      const color = ROOM_TYPE_COLOR[t] ?? "#f59e0b";
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setRoomType(t)}
                          className="option-card"
                          style={{
                            minHeight: 44,
                            padding: "9px 13px",
                            borderColor: active ? color : undefined,
                            background: active ? `${color}11` : undefined,
                          }}
                        >
                          <p
                            className="font-mono lowercase text-[0.75rem]"
                            style={{ color: active ? color : "var(--text-primary)" }}
                          >
                            {t}
                          </p>
                          <p
                            className="font-sans lowercase text-text-faint mt-0.5"
                            style={{ fontSize: "10.5px" }}
                          >
                            {ROOM_TYPE_LABEL[t]}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <label>tag</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {TAGS.map((t) => {
                      const active = tag === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTag(t)}
                          className={`option-chip${active ? " selected" : ""}`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Destination selector — hidden when locked to pulse */}
              {!isPulse && (
                <div>
                  <label>destination</label>
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
                          title={disabled ? "join a cohort to post here" : undefined}
                          className={`option-chip flex-1${active ? " selected" : ""}`}
                          style={{
                            borderRadius: "var(--radius-ctl)",
                            padding: "7px 12px",
                            opacity: disabled ? 0.35 : 1,
                            cursor: disabled ? "not-allowed" : "pointer",
                          }}
                        >
                          {d === "cohort" ? "cohort_feed" : "pulse"}
                        </button>
                      );
                    })}
                  </div>
                  {inNoCohort && (
                    <p className="font-mono lowercase text-text-faint mt-1.5" style={{ fontSize: "10px" }}>
                      join a cohort to post here
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setAnon((v) => !v)}
                  aria-pressed={anon}
                  className="relative shrink-0"
                  style={{
                    flex: "0 0 34px",
                    width: 34,
                    minWidth: 34,
                    maxWidth: 34,
                    height: 18,
                    minHeight: 18,
                    maxHeight: 18,
                    padding: 0,
                    borderRadius: 9999,
                    background: anon ? "#f59e0b" : "var(--border)",
                    transition: "background 150ms ease",
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
                <div className="text-[0.7rem] leading-snug" style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <p className="font-mono lowercase text-text-secondary">post anonymously</p>
                  <p className="font-mono lowercase text-text-faint">
                    {isPulse
                      ? "the community sees your words, not your name"
                      : "your cohort sees the post but not your name"}
                  </p>
                </div>
              </div>

              {err && <p className="font-mono text-xs text-red-400 lowercase">{err}</p>}
            </div>

            <div className="modal-shell-foot">
              <button onClick={() => setOpen(false)} className="btn-ghost" disabled={busy}>
                cancel
              </button>
              <button
                onClick={submit}
                disabled={busy || !content.trim()}
                className="btn-primary"
              >
                {busy ? "..." : isPulse ? "post to the room " : "post "}
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
          currentUsage={paywallState.currentUsage}
          limit={paywallState.limit}
          hadTrial={paywallState.hadTrial}
        />
      )}
    </>
  );
}
