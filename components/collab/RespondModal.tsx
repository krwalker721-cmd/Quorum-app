"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectRow } from "./CollabBoardClient";

export default function RespondModal({
  project,
  userId,
  onClose,
  onResponded,
}: {
  project: ProjectRow;
  userId: string;
  onClose: () => void;
  onResponded: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error: e1 } = await supabase
      .from("project_interests")
      .insert({ project_id: project.id, user_id: userId, note: note.trim() || null });
    if (e1 && !e1.message.toLowerCase().includes("duplicate")) {
      setBusy(false);
      setErr(e1.message.toLowerCase());
      return;
    }
    if (project.owner_id && note.trim()) {
      await supabase.from("messages").insert({
        sender_id: userId,
        recipient_id: project.owner_id,
        content: `re: ${project.title}\n\n${note.trim()}`,
      });
    }
    setBusy(false);
    onResponded();
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
            <p className="modal-kicker">respond</p>
            <h2 className="modal-title truncate">{project.title.toLowerCase()}</h2>
            <p className="modal-subtitle">
              a short note to {project.author?.full_name?.toLowerCase() ?? "the author"} explaining
              why you&apos;d be a fit. they&apos;ll be notified via dm.
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            esc
          </button>
        </div>

        <div className="modal-shell-body">
          <textarea
            rows={5}
            autoFocus
            placeholder="i'd be a good fit because..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {err && <p className="font-mono text-xs text-red-400 lowercase">{err}</p>}
        </div>

        <div className="modal-shell-foot">
          <button onClick={onClose} className="btn-ghost" disabled={busy}>
            cancel
          </button>
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? "..." : "send "}
          </button>
        </div>
      </div>
    </div>
  );
}
