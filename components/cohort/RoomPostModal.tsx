"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type RoomType = "question" | "update" | "decision" | "win" | "blocker";

const TYPES: { value: RoomType; color: string; desc: string }[] = [
  { value: "question", color: "#38bdf8", desc: "needs input from the room" },
  { value: "update", color: "#6e7681", desc: "here's where i'm at" },
  { value: "decision", color: "#f59e0b", desc: "deciding something, thoughts welcome" },
  { value: "win", color: "#22c55e", desc: "something worked" },
  { value: "blocker", color: "#f59e0b", desc: "stuck on something specific" },
];

export default function RoomPostModal({
  userId,
  cohortId,
  onClose,
}: {
  userId: string;
  cohortId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<RoomType>("update");
  const [content, setContent] = useState("");
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!content.trim()) return;
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.from("posts").insert({
      author_id: userId,
      content: content.trim(),
      post_type: "cohort",
      cohort_id: cohortId,
      room_type: type,
      is_anonymous: anon,
      local_hour: new Date().getHours(),
    });
    setBusy(false);
    if (error) {
      setErr(error.message.toLowerCase());
      return;
    }
    if (anon) {
      fetch("/api/recognition/anonymous-post", { method: "POST" }).catch(() => {});
    }
    onClose();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl border p-6 space-y-5"
        style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-mono lowercase text-xs text-text-muted">
            new room post
          </p>
          <button
            onClick={onClose}
            className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-primary"
          >
            close
          </button>
        </div>

        <div>
          <label>type</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {TYPES.map((t) => {
              const active = type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className="font-mono lowercase text-left px-3 py-2.5 transition-colors"
                  style={{
                    border: `1px solid ${active ? t.color : "var(--border)"}`,
                    background: active ? `${t.color}14` : "transparent",
                  }}
                >
                  <p
                    className="text-[0.8rem]"
                    style={{ color: active ? t.color : "var(--text-primary)" }}
                  >
                    {t.value}
                  </p>
                  <p className="text-[0.6rem] text-text-faint mt-0.5">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label>content</label>
          <textarea
            rows={5}
            placeholder="what's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex items-start gap-3 pt-1">
          <button
            type="button"
            onClick={() => setAnon((v) => !v)}
            aria-pressed={anon}
            className="relative shrink-0"
            style={{
              width: 34,
              height: 18,
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
          <div className="text-[0.7rem] leading-snug">
            <p className="font-mono lowercase text-text-secondary">
              post anonymously
            </p>
            <p className="font-mono lowercase text-text-faint">
              the room sees the post but not your name
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
            {busy ? "..." : "post to room "}
          </button>
        </div>
      </div>
    </div>
  );
}
