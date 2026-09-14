"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import ui from "@/components/ui/sleek.module.css";
import { timeAgo } from "@/lib/stage";
import type { ProjectRow } from "./CollabBoardClient";

function sentence(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

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
      setErr(sysErr.message);
      return;
    }
    const { error: msgErr } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      recipient_id: need.owner_id,
      content: trimmed,
    });
    if (msgErr) {
      setBusy(false);
      setErr(msgErr.message);
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
        role="dialog"
        aria-label={need.title}
        className="modal-shell w-full max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell-head">
          <div className="min-w-0">
            <p className="modal-kicker">Ask</p>
            <h3 className="modal-title">{need.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close">
            Esc
          </button>
        </div>

        <div className="modal-shell-body">
          <div className="flex items-center gap-2 flex-wrap">
            <Avatar
              name={need.author?.full_name}
              stage={need.author?.stage}
              username={need.author?.username}
              size={30}
            />
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
              {need.author?.full_name ?? "—"}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {timeAgo(need.created_at)} ago</span>
            {need.category && <span className={`${ui.chip} sm:ml-auto`}>{sentence(need.category)}</span>}
            {need.looking_for && <span className={ui.chip}>{sentence(need.looking_for)}</span>}
          </div>

          {need.description && (
            <p className="whitespace-pre-wrap" style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              {need.description}
            </p>
          )}

          <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: 16 }}>
            {isOwner ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                This is your ask. Use &ldquo;View applications&rdquo; on its card to see who&apos;s
                responded.
              </p>
            ) : (
              <>
                <label htmlFor="need-response">How can you help?</label>
                <textarea
                  id="need-response"
                  rows={4}
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="A quick note on how you can help…"
                  autoFocus
                />
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                  This opens a direct message with {need.author?.full_name?.split(" ")[0] || "them"}.
                </p>
                {err && <p style={{ fontSize: 13, color: "#f87171", marginTop: 8 }}>{err}</p>}
              </>
            )}
          </div>
        </div>

        {!isOwner && (
          <div className="modal-shell-foot">
            <button type="button" onClick={onClose} className="btn-ghost" disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={busy || !response.trim()}
              className="btn-primary"
            >
              {busy ? "Sending…" : "Send →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
