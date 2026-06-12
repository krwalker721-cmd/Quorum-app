"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectRow } from "./CollabBoardClient";

const OFFER_OPTIONS = ["co-thinker", "technical", "design", "sales-growth", "advisor"];

export default function JoinRequestModal({
  project,
  currentUserId,
  onClose,
  onSent,
}: {
  project: ProjectRow;
  currentUserId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [reason, setReason] = useState("");
  const [offer, setOffer] = useState<string>(
    project.looking_for && OFFER_OPTIONS.includes(project.looking_for)
      ? project.looking_for
      : OFFER_OPTIONS[0]
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const reasonOk = reason.trim().length >= 20;

  async function submit() {
    if (!reasonOk || busy) return;
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.from("join_requests").insert({
      project_id: project.id,
      requester_id: currentUserId,
      reason: reason.trim(),
      what_they_offer: offer,
    });
    if (error) {
      setBusy(false);
      setErr(error.message.toLowerCase());
      return;
    }
    // Notify the project owner
    if (project.owner_id) {
      await supabase.from("notifications").insert({
        user_id: project.owner_id,
        type: "join_request",
        kind: "join_request",
        message: `new join request for "${project.title}"`,
        source_id: project.id,
        source_type: "project",
      });
    }
    setBusy(false);
    onSent();
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="modal-shell w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell-head">
          <div className="min-w-0">
            <p className="modal-kicker">request to join</p>
            <h3 className="modal-title truncate">{project.title}</h3>
            <p className="modal-subtitle">
              the project owner reads this — say something only you could say.
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="close">
            esc
          </button>
        </div>

        <div className="modal-shell-body">
          <div>
            <label>why do you want to join this project?</label>
            <textarea
              rows={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="share why you're a good fit…"
              autoFocus
            />
            <p
              className="font-mono lowercase text-[0.6rem] mt-1.5"
              style={{ color: reasonOk ? "#22c55e" : "var(--text-faint)" }}
            >
              {reasonOk ? "✓ " : ""}{reason.trim().length}/20 characters
            </p>
          </div>

          <div>
            <label>what can you offer?</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {OFFER_OPTIONS.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOffer(o)}
                  className={`option-chip${offer === o ? " selected" : ""}`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {err && <p className="font-mono text-xs text-red-400 lowercase">{err}</p>}
        </div>

        <div className="modal-shell-foot">
          <button onClick={onClose} className="btn-ghost" disabled={busy}>
            cancel
          </button>
          <button
            onClick={submit}
            disabled={!reasonOk || busy}
            className="btn-primary"
          >
            {busy ? "…" : "send request →"}
          </button>
        </div>
      </div>
    </div>
  );
}
