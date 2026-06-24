"use client";

import { useState } from "react";
import { ActionChapter } from "./actionChapter";
import {
  C,
  MONO,
  SANS,
  hexToRgba,
  TYPE_COLORS,
  darkTextarea,
  AmberButton,
  SkipLink,
} from "./theme";

const POST_TYPES = ["decision", "question", "blocker", "win"] as const;
type PostType = (typeof POST_TYPES)[number];

// Chapter 10 — the first post. Posts to the cohort room via /api/posts, falling
// back to a pulse post if the user has no cohort yet.
export function ChapterFirstPost({
  cohortId,
  onComplete,
}: {
  cohortId: string | null;
  onComplete: () => void;
}) {
  const [type, setType] = useState<PostType>("decision");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          post_type: cohortId ? "cohort" : "pulse",
          ...(cohortId ? { cohort_id: cohortId } : {}),
          room_type: type,
          is_anonymous: false,
          local_hour: new Date().getHours(),
        }),
      });
    } catch {
      // best-effort
    }
    onComplete();
  }

  return (
    <ActionChapter id="chapter-10" context="// your cohort is waiting on this" contextColor={C.amber}>
      <p
        style={{
          fontFamily: SANS,
          fontSize: 14,
          color: C.textMuted,
          textAlign: "center",
          margin: "0 0 16px",
        }}
      >
        What&rsquo;s on your mind right now — post it to your cohort.
      </p>

      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderLeft: `2px solid ${C.amber}`,
          borderRadius: "0 4px 4px 0",
          padding: 20,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {POST_TYPES.map((t) => {
            const active = type === t;
            const color = TYPE_COLORS[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  padding: "7px 14px",
                  borderRadius: 4,
                  cursor: "pointer",
                  border: `1px solid ${active ? color : C.border}`,
                  background: active ? hexToRgba(color, 0.06) : C.surface,
                  color: active ? color : C.textSecondary,
                  transition: "all 150ms ease",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="what's on your mind right now..."
          style={{ ...darkTextarea, minHeight: 120 }}
        />

        <div style={{ fontFamily: MONO, fontSize: 10, color: C.textDisabled, marginTop: 12 }}>
          // posting to your cohort
        </div>

        <div style={{ marginTop: 16 }}>
          <AmberButton onClick={submit} disabled={saving || !content.trim()}>
            Post to my cohort →
          </AmberButton>
          <SkipLink onClick={onComplete}>skip for now →</SkipLink>
        </div>

        <div style={{ fontFamily: MONO, fontSize: 9, color: C.borderMuted, marginTop: 14 }}>
          // only your cohort can see this
        </div>
      </div>
    </ActionChapter>
  );
}
