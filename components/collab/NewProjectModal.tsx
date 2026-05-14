"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PROJECT_CATEGORIES = ["growth", "fundraising", "hiring", "product", "ops"];
const NEED_CATEGORIES = ["quick_ask", "need"];
const LOOKING_FOR = ["co-thinker", "technical", "design", "sales-growth", "advisor"];

export default function NewProjectModal({
  userId,
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
    const supabase = createClient();
    const { error } = await supabase.from("projects").insert({
      owner_id: userId,
      title: title.trim(),
      name: title.trim(),
      description: description.trim() || null,
      category,
      looking_for: postType === "project" ? lookingFor : null,
      status: "open",
      post_type: postType,
    });
    setBusy(false);
    if (error) {
      setErr(error.message.toLowerCase());
      return;
    }
    onCreated();
  }

  const categories = postType === "project" ? PROJECT_CATEGORIES : NEED_CATEGORIES;

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
            new {postType === "project" ? "project" : "need"}
          </p>
          <button
            onClick={onClose}
            className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-primary"
          >
            close
          </button>
        </div>

        <input
          placeholder="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          className="w-full px-3 py-2 font-sans text-text-primary"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        />

        <textarea
          rows={4}
          placeholder="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 text-text-primary"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        />

        <div>
          <label className="font-mono lowercase text-[0.65rem] text-text-faint">category</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {categories.map((c) => {
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className="font-mono lowercase text-[0.65rem] px-2 py-1"
                  style={{
                    border: `1px solid ${active ? "#f59e0b" : "var(--border)"}`,
                    color: active ? "#f59e0b" : "var(--text-muted)",
                    background: active ? "rgba(245,158,11,0.08)" : "transparent",
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {postType === "project" && (
          <div>
            <label className="font-mono lowercase text-[0.65rem] text-text-faint">looking_for</label>
            <select
              value={lookingFor}
              onChange={(e) => setLookingFor(e.target.value)}
              className="block mt-1 px-3 py-2 font-mono lowercase text-xs text-text-primary"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              {LOOKING_FOR.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}

        {err && <p className="font-mono text-xs text-red-400 lowercase">{err}</p>}

        <div className="flex justify-end">
          <button
            onClick={submit}
            disabled={busy || !title.trim()}
            className="font-mono lowercase text-xs px-4 py-2 hover:opacity-90 disabled:opacity-50"
            style={{ background: "#f59e0b", color: "#000" }}
          >
            {busy ? "..." : "post →"}
          </button>
        </div>
      </div>
    </div>
  );
}
