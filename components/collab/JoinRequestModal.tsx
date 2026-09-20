"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectRow } from "./CollabBoardClient";

const OFFER_OPTIONS = ["co-thinker", "technical", "design", "sales-growth", "advisor"];
const MIN_REASON = 20;

function sentence(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

  const length = reason.trim().length;
  const reasonOk = length >= MIN_REASON;

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
      setErr(error.message);
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
        role="dialog"
        aria-label={`Request to join ${project.title}`}
        className="modal-shell w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell-head">
          <div className="min-w-0">
            <p className="modal-kicker">Request to join</p>
            <h3 className="modal-title truncate">{project.title}</h3>
            <p className="modal-subtitle">
              The project owner reads this, so say something only you could say.
            </p>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close">
            Esc
          </button>
        </div>

        <div className="modal-shell-body">
          <div>
            <label htmlFor="join-reason">Why do you want to join this project?</label>
            <textarea
              id="join-reason"
              rows={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Share why you're a good fit…"
              autoFocus
            />
            <p style={{ fontSize: 11.5, marginTop: 6, color: reasonOk ? "#4ade80" : "var(--text-muted)" }}>
              {reasonOk ? "✓ Enough to send" : `At least ${MIN_REASON} characters · ${length} so far`}
            </p>
          </div>

          <div>
            <label>What can you offer?</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {OFFER_OPTIONS.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOffer(o)}
                  aria-pressed={offer === o}
                  className={`option-chip${offer === o ? " selected" : ""}`}
                >
                  {sentence(o)}
                </button>
              ))}
            </div>
          </div>

          {err && <p style={{ fontSize: 12, color: "#f87171" }}>{err}</p>}
        </div>

        <div className="modal-shell-foot">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!reasonOk || busy} className="btn-primary">
            {busy ? "Sending…" : "Send request →"}
          </button>
        </div>
      </div>
    </div>
  );
}
