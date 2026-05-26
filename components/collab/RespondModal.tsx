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
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-lg border p-6 space-y-4"
        style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-mono lowercase text-xs text-text-muted">
            respond to {project.title.toLowerCase()}
          </p>
          <button
            onClick={onClose}
            className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-primary"
          >
            close
          </button>
        </div>

        <p className="font-mono lowercase text-[0.7rem] text-text-faint">
          a short note to {project.author?.full_name?.toLowerCase() ?? "the author"} explaining why you'd be a fit. they'll be notified via dm.
        </p>

        <textarea
          rows={5}
          autoFocus
          placeholder="i'd be a good fit because..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full px-3 py-2 text-text-primary"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        />

        {err && <p className="font-mono text-xs text-red-400 lowercase">{err}</p>}

        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={busy}
            className="font-mono lowercase text-xs px-4 py-2 hover:opacity-90 disabled:opacity-50"
            style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
          >
            {busy ? "..." : "send "}
          </button>
        </div>
      </div>
    </div>
  );
}
