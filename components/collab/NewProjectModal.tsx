"use client";

import { useState } from "react";
import { reportPosted } from "@/lib/tour-bus";

const PROJECT_CATEGORIES = ["growth", "fundraising", "hiring", "product", "ops"];
const NEED_CATEGORIES = ["quick_ask", "need"];
const LOOKING_FOR = ["co-thinker", "technical", "design", "sales-growth", "advisor"];

// "quick_ask" → "Quick ask", "co-thinker" → "Co-thinker"
function sentence(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function NewProjectModal({
  postType,
  initialTitle = "",
  onClose,
  onCreated,
  onUpgradeRequired,
}: {
  userId: string;
  postType: "project" | "need";
  // Pre-typed opener, handed in by the guided tour's sentence starters.
  initialTitle?: string;
  onClose: () => void;
  onCreated: () => void;
  // Called when the server rejects the create for lack of a plan, so the board
  // can raise the upgrade overlay instead of this modal showing an error.
  onUpgradeRequired?: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(postType === "project" ? "growth" : "quick_ask");
  const [lookingFor, setLookingFor] = useState(LOOKING_FOR[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    // Server route enforces the collab cap and increments usage after the insert.
    const res = await fetch("/api/collab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        name: title.trim(),
        description: description.trim() || null,
        category,
        looking_for: postType === "project" ? lookingFor : null,
        status: "open",
        post_type: postType,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.code === "UPGRADE_REQUIRED" && onUpgradeRequired) {
        onUpgradeRequired();
        return;
      }
      setErr(data.error || "Couldn't post that. Try again.");
      return;
    }
    // Let a waiting tour step know the post actually landed.
    reportPosted("collab-project");
    onCreated();
  }

  const categories = postType === "project" ? PROJECT_CATEGORIES : NEED_CATEGORIES;

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-label={postType === "project" ? "Post a project" : "Post an ask"}
        className="modal-shell w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell-head">
          <div className="min-w-0">
            <p className="modal-kicker">Collab board</p>
            <h2 className="modal-title">
              {postType === "project" ? "Post a project" : "Post an ask"}
            </h2>
            <p className="modal-subtitle">
              {postType === "project"
                ? "Tell the room what you're building and who you need."
                : "Be specific. Specific asks get answered."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn">
            Esc
          </button>
        </div>

        <div className="modal-shell-body">
          <div>
            <label htmlFor="collab-title">Title</label>
            <input
              id="collab-title"
              placeholder={postType === "project" ? "What are you building?" : "What do you need?"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="collab-description">Description</label>
            <textarea
              id="collab-description"
              rows={4}
              placeholder="Give it enough detail to act on…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label>Category</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={`option-chip${category === c ? " selected" : ""}`}
                >
                  {sentence(c)}
                </button>
              ))}
            </div>
          </div>

          {postType === "project" && (
            <div>
              <label>Looking for</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {LOOKING_FOR.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLookingFor(l)}
                    aria-pressed={lookingFor === l}
                    className={`option-chip${lookingFor === l ? " selected" : ""}`}
                  >
                    {sentence(l)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {err && <p style={{ fontSize: 12, color: "#f87171" }}>{err}</p>}
        </div>

        <div className="modal-shell-foot">
          <button type="button" onClick={onClose} className="btn-ghost" disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !title.trim()}
            className="btn-primary"
          >
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
