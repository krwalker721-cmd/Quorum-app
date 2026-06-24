"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ActionChapter } from "./actionChapter";
import {
  C,
  MONO,
  SANS,
  hexToRgba,
  darkInput,
  AmberButton,
  SkipLink,
  CardHeader,
} from "./theme";

const DEFAULT_SKILLS = [
  "fundraising", "product", "growth", "sales", "marketing", "engineering", "design",
  "hiring", "operations", "finance", "legal", "partnerships", "go-to-market", "brand",
  "content", "community", "ai/ml", "b2b saas", "consumer", "hardware",
];

// Chapter 8 — the skills action card. Saves the selected set to profiles.skills.
export function ChapterSkills({ onComplete }: { onComplete: () => void }) {
  const [extra, setExtra] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  const allSkills = [...DEFAULT_SKILLS, ...extra];
  const count = selected.size;

  function toggle(skill: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  }

  function addCustom() {
    const s = custom.trim().toLowerCase();
    if (!s) return;
    if (!allSkills.includes(s)) setExtra((prev) => [...prev, s]);
    setSelected((prev) => new Set(prev).add(s));
    setCustom("");
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && selected.size > 0) {
        await supabase.from("profiles").update({ skills: Array.from(selected) }).eq("id", user.id);
      }
    } catch {
      // best-effort
    }
    onComplete();
  }

  return (
    <ActionChapter id="chapter-8" context="// what do you bring to this room?">
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: 28,
          boxSizing: "border-box",
        }}
      >
        <CardHeader>// your strengths</CardHeader>
        <div
          style={{
            background: C.surface,
            borderLeft: `2px solid ${C.amber}`,
            padding: "10px 14px",
            borderRadius: "0 4px 4px 0",
            fontFamily: SANS,
            fontSize: 13,
            color: C.textSecondary,
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          The best connections here are built on knowing what each other is good at.
        </div>

        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: count > 0 ? C.amber : C.textDisabled,
            letterSpacing: "0.06em",
            marginBottom: 14,
          }}
        >
          {count} selected
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allSkills.map((skill) => {
            const active = selected.has(skill);
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggle(skill)}
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  padding: "8px 14px",
                  borderRadius: 4,
                  cursor: "pointer",
                  border: `1px solid ${active ? C.amber : C.border}`,
                  background: active ? hexToRgba(C.amber, 0.06) : C.surface,
                  color: active ? C.amber : C.textSecondary,
                  transition: "all 150ms ease",
                }}
              >
                {skill}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="add your own skill..."
            style={{ ...darkInput, flex: 1 }}
          />
          <button
            type="button"
            onClick={addCustom}
            style={{
              fontFamily: MONO,
              fontSize: 12,
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: C.textSecondary,
              padding: "10px 16px",
              borderRadius: 4,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + add
          </button>
        </div>

        <div style={{ marginTop: 24 }}>
          <AmberButton onClick={save} disabled={saving}>
            These are my strengths →
          </AmberButton>
          <SkipLink onClick={onComplete}>skip for now →</SkipLink>
        </div>
      </div>
    </ActionChapter>
  );
}
