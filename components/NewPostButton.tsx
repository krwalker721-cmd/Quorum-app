"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ROOM_TYPE_COLOR, ROOM_TYPE_LABEL } from "@/lib/stage";

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
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-lg border p-6 space-y-4"
            style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono lowercase text-xs text-text-muted">
                  {isPulse ? "post to the community" : "new post"}
                </p>
                {isPulse && (
                  <p
                    className="font-sans lowercase text-text-faint mt-1"
                    style={{ fontSize: "11px" }}
                  >
                    this goes to every founder on quorum. make it worth their attention.
                  </p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-primary"
              >
                close
              </button>
            </div>

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
                        className="text-left transition-colors"
                        style={{
                          minHeight: 40,
                          padding: "8px 12px",
                          border: `1px solid ${active ? color : "var(--border)"}`,
                          background: active ? `${color}11` : "transparent",
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
                          style={{ fontSize: "10px" }}
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
                        className="font-mono lowercase text-[0.65rem] px-2 py-1 transition-colors"
                        style={{
                          border: `1px solid ${active ? "#f59e0b" : "var(--border)"}`,
                          color: active ? "#f59e0b" : "var(--text-muted)",
                          background: active ? "rgba(245, 158, 11,0.08)" : "transparent",
                        }}
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
                        className="font-mono lowercase text-[0.7rem] px-3 py-1.5 flex-1 transition-colors"
                        style={{
                          border: `1px solid ${active ? "#f59e0b" : "var(--border)"}`,
                          color: active ? "#f59e0b" : "var(--text-muted)",
                          background: active ? "rgba(245, 158, 11,0.08)" : "transparent",
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
                  <p className="font-mono lowercase text-text-faint mt-1" style={{ fontSize: "10px" }}>
                    join a cohort to post here
                  </p>
                )}
              </div>
            )}

            <div className="flex items-start gap-3 pt-1">
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

            <div className="flex justify-end pt-2">
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
    </>
  );
}
