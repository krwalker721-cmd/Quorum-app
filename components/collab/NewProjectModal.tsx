"use client";

import { useState } from "react";

const PROJECT_CATEGORIES = ["growth", "fundraising", "hiring", "product", "ops"];
const NEED_CATEGORIES = ["quick_ask", "need"];
const LOOKING_FOR = ["co-thinker", "technical", "design", "sales-growth", "advisor"];

export default function NewProjectModal({
  postType,
  onClose,
  onCreated,
}: {
  userId: string;
  postType: "project" | "need";
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
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
      setErr((data.error || "failed to create").toLowerCase());
      return;
    }
    onCreated();
  }

  const categories = postType === "project" ? PROJECT_CATEGORIES : NEED_CATEGORIES;

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
            <p className="modal-kicker">collab_board</p>
            <h2 className="modal-title">
              {postType === "project" ? "post a project" : "post an ask"}
            </h2>
            <p className="modal-subtitle">
              {postType === "project"
                ? "tell the room what you're building and who you need."
                : "be specific — specific asks get answered."}
            </p>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            esc
          </button>
        </div>

        <div className="modal-shell-body">
          <div>
            <label>title</label>
            <input
              placeholder={postType === "project" ? "what are you building?" : "what do you need?"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label>description</label>
            <textarea
              rows={4}
              placeholder="give it enough detail to act on…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label>category</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`option-chip${category === c ? " selected" : ""}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {postType === "project" && (
            <div>
              <label>looking_for</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {LOOKING_FOR.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLookingFor(l)}
                    className={`option-chip${lookingFor === l ? " selected" : ""}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {err && <p className="font-mono text-xs text-red-400 lowercase">{err}</p>}
        </div>

        <div className="modal-shell-foot">
          <button onClick={onClose} className="btn-ghost" disabled={busy}>
            cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !title.trim()}
            className="btn-primary"
          >
            {busy ? "..." : "post "}
          </button>
        </div>
      </div>
    </div>
  );
}
