"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/stage";
import type { ProjectRow } from "./CollabBoardClient";

export default function NeedDetailModal({
  need,
  currentUserId,
  onClose,
}: {
  need: ProjectRow;
  currentUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isOwner = need.owner_id === currentUserId;

  async function apply() {
    if (!need.owner_id) return;
    const trimmed = response.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    const supabase = createClient();

    // Record the application (best-effort; unique constraint may collide)
    await supabase.from("need_applications").insert({
      need_id: need.id,
      applicant_id: currentUserId,
      response: trimmed,
    });

    // Create a DM thread: system message + applicant's first message.
    const systemContent = `[system] you applied to "${need.title}"`;
    const { error: sysErr } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      recipient_id: need.owner_id,
      content: systemContent,
    });
    if (sysErr) {
      setBusy(false);
      setErr(sysErr.message.toLowerCase());
      return;
    }
    const { error: msgErr } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      recipient_id: need.owner_id,
      content: trimmed,
    });
    if (msgErr) {
      setBusy(false);
      setErr(msgErr.message.toLowerCase());
      return;
    }

    // Notification for the owner
    await supabase.from("notifications").insert({
      user_id: need.owner_id,
      type: "need_application",
      kind: "need_application",
      message: `new applicant for "${need.title}"`,
      source_id: need.id,
      source_type: "need",
    });

    setBusy(false);
    router.push(`/messages?to=${need.owner_id}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-xl border p-6 space-y-4"
        style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono lowercase text-[0.6rem] text-text-faint mb-1">need</p>
            <h3 className="font-sans text-text-primary text-xl lowercase">{need.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-primary"
            aria-label="close"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Avatar
            name={need.author?.full_name}
            stage={need.author?.stage}
            username={need.author?.username}
            size={28}
          />
          <span className="font-mono lowercase text-[0.7rem] text-text-primary">
            {need.author?.full_name?.toLowerCase() ?? "—"}
          </span>
          <span className="font-mono lowercase text-[0.6rem] text-text-faint">
            · {timeAgo(need.created_at)} ago
          </span>
          {need.category && (
            <span
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5 ml-auto"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              {need.category}
            </span>
          )}
          {need.looking_for && (
            <span
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              {need.looking_for}
            </span>
          )}
        </div>

        {need.description && (
          <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
            {need.description}
          </p>
        )}

        <div className="border-t pt-4 mt-2" style={{ borderColor: "var(--border)" }}>
          {isOwner ? (
            <p className="font-mono lowercase text-xs text-text-faint">
              this is your need. use &quot;view applications&quot; on the card to see applicants.
            </p>
          ) : (
            <>
              <label className="font-mono lowercase text-[0.65rem] text-text-faint">
                how can you help?
              </label>
              <textarea
                rows={4}
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="quick note on how you can help…"
                className="w-full px-3 py-2 mt-1 text-text-primary"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                autoFocus
              />
              {err && <p className="font-mono text-xs text-red-400 lowercase mt-2">{err}</p>}
              <div className="flex justify-end mt-3">
                <button
                  onClick={apply}
                  disabled={busy || !response.trim()}
                  className="font-mono lowercase text-[0.7rem] px-4 py-2 hover:opacity-90 disabled:opacity-50"
                  style={{
                    background: "rgba(245, 158, 11, 0.18)",
                    color: "#f59e0b",
                    border: "1px solid rgba(245, 158, 11, 0.55)",
                    borderRadius: 5,
                    boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                  }}
                >
                  {busy ? "…" : "apply →"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
