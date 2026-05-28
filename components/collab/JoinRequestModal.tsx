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
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-lg border p-6 space-y-4"
        style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono lowercase text-[0.6rem] text-text-faint mb-1">request to join</p>
            <h3 className="font-sans text-text-primary text-lg lowercase truncate">{project.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-text-faint hover:text-text-primary text-lg"
            aria-label="close"
          >
            ✕
          </button>
        </div>

        <div>
          <label className="font-mono lowercase text-[0.65rem] text-text-faint">
            why do you want to join this project? (min 20 chars)
          </label>
          <textarea
            rows={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="share why you're a good fit…"
            className="w-full px-3 py-2 mt-1 text-text-primary"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            autoFocus
          />
          <p
            className="font-mono lowercase text-[0.6rem] mt-1"
            style={{ color: reasonOk ? "#22c55e" : "var(--text-faint)" }}
          >
            {reason.trim().length}/20
          </p>
        </div>

        <div>
          <label className="font-mono lowercase text-[0.65rem] text-text-faint">
            what can you offer?
          </label>
          <select
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            className="block mt-1 px-3 py-2 font-mono lowercase text-xs text-text-primary"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            {OFFER_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        {err && <p className="font-mono text-xs text-red-400 lowercase">{err}</p>}

        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={!reasonOk || busy}
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
            {busy ? "…" : "send request →"}
          </button>
        </div>
      </div>
    </div>
  );
}
