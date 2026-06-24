"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ActionChapter } from "./actionChapter";
import { C, SANS, darkTextarea, AmberButton, SkipLink, FieldLabel } from "./theme";

// Chapter 11 — the weekly check-in. Inserts into check_ins with colored accents
// for the three prompts (shipped / focus / stuck).
export function ChapterCheckin({ onComplete }: { onComplete: () => void }) {
  const [shipped, setShipped] = useState("");
  const [focus, setFocus] = useState("");
  const [stuck, setStuck] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && (shipped.trim() || focus.trim() || stuck.trim())) {
        await supabase.from("check_ins").insert({
          user_id: user.id,
          weekly_win: shipped.trim() || null,
          decision: focus.trim() || null,
          blocker: stuck.trim() || null,
          is_anonymous: false,
        });
      }
    } catch {
      // best-effort
    }
    onComplete();
  }

  const blocks = [
    {
      accent: C.green,
      label: "what did you ship this week?",
      value: shipped,
      set: setShipped,
      placeholder: "e.g. shipped the landing page, closed two calls...",
    },
    {
      accent: C.amber,
      label: "what are you focused on next week?",
      value: focus,
      set: setFocus,
      placeholder: "e.g. hire first engineer, lock pricing...",
    },
    {
      accent: C.red,
      label: "where are you stuck?",
      value: stuck,
      set: setStuck,
      placeholder: "e.g. can't decide between two pricing models...",
    },
  ];

  return (
    <ActionChapter id="chapter-11" context="// show up every week">
      <p
        style={{
          fontFamily: SANS,
          fontSize: 14,
          color: C.textMuted,
          textAlign: "center",
          margin: "0 0 16px",
        }}
      >
        Three questions. Under 3 minutes. Every week.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {blocks.map((b) => (
          <div
            key={b.label}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderLeft: `2px solid ${b.accent}`,
              borderRadius: "0 4px 4px 0",
              padding: "14px 16px",
            }}
          >
            <FieldLabel>{b.label}</FieldLabel>
            <textarea
              value={b.value}
              onChange={(e) => b.set(e.target.value)}
              placeholder={b.placeholder}
              style={{ ...darkTextarea, minHeight: 60 }}
            />
          </div>
        ))}
        <div style={{ marginTop: 8 }}>
          <AmberButton onClick={submit} disabled={saving}>
            Submit my check-in →
          </AmberButton>
          <SkipLink onClick={onComplete}>skip for now →</SkipLink>
        </div>
      </div>
    </ActionChapter>
  );
}
