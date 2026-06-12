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
      className="modal-overlay fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="modal-shell w-full max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell-head">
          <div className="min-w-0">
            <p className="modal-kicker">ask</p>
            <h3 className="modal-title">{need.title}</h3>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="close">
            esc
          </button>
        </div>

        <div className="modal-shell-body">
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
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5 ml-auto rounded-full"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              {need.category}
            </span>
          )}
          {need.looking_for && (
            <span
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5 rounded-full"
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

        <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
          {isOwner ? (
            <p className="font-mono lowercase text-xs text-text-faint">
              this is your ask. use &quot;view applications&quot; on the card to see applicants.
            </p>
          ) : (
            <>
              <label>how can you help?</label>
              <textarea
                rows={4}
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="quick note on how you can help…"
                autoFocus
              />
              {err && <p className="font-mono text-xs text-red-400 lowercase mt-2">{err}</p>}
            </>
          )}
        </div>
        </div>

        {!isOwner && (
          <div className="modal-shell-foot">
            <button onClick={onClose} className="btn-ghost" disabled={busy}>
              cancel
            </button>
            <button
              onClick={apply}
              disabled={busy || !response.trim()}
              className="btn-primary"
            >
              {busy ? "…" : "apply →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
