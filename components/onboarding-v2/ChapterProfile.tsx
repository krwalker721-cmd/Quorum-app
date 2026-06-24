"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ActionChapter } from "./actionChapter";
import {
  C,
  MONO,
  hexToRgba,
  STAGE_COLORS,
  darkInput,
  darkTextarea,
  AmberButton,
  SkipLink,
  CardHeader,
  FieldLabel,
} from "./theme";

const STAGES = [
  { value: "idea", label: "idea" },
  { value: "pre-seed", label: "pre-seed" },
  { value: "seed", label: "seed" },
  { value: "series_a", label: "series a" },
];

// Chapter 7 — the profile action card. Best-effort write to profiles; advancing
// the flow always wins over a failed save.
export function ChapterProfile({ onComplete }: { onComplete: () => void }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [building, setBuilding] = useState("");
  const [stage, setStage] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const payload: Record<string, unknown> = {};
        const fullName = `${first.trim()} ${last.trim()}`.trim();
        if (fullName) payload.full_name = fullName;
        if (building.trim()) payload.what_they_are_building = building.trim();
        if (stage) payload.stage = stage;
        if (bio.trim()) payload.bio = bio.trim();
        if (Object.keys(payload).length > 0) {
          await supabase.from("profiles").update(payload).eq("id", user.id);
        }
      }
    } catch {
      // best-effort — advancing matters more than the write succeeding
    }
    onComplete();
  }

  return (
    <ActionChapter id="chapter-7" context="// first — let your cohort know who you are">
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: 28,
          boxSizing: "border-box",
        }}
      >
        <CardHeader>// build your profile</CardHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>first name</FieldLabel>
              <input
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                placeholder="your first name"
                style={darkInput}
              />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>last name</FieldLabel>
              <input
                value={last}
                onChange={(e) => setLast(e.target.value)}
                placeholder="your last name"
                style={darkInput}
              />
            </div>
          </div>

          <div>
            <FieldLabel>what are you building?</FieldLabel>
            <input
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              placeholder="e.g. a platform for founders..."
              style={darkInput}
            />
          </div>

          <div>
            <FieldLabel>stage</FieldLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {STAGES.map((s) => {
                const active = stage === s.value;
                const color = STAGE_COLORS[s.value] ?? C.amber;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStage(active ? "" : s.value)}
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      padding: "8px 16px",
                      borderRadius: 4,
                      cursor: "pointer",
                      border: `1px solid ${active ? color : C.border}`,
                      color: active ? color : C.textSecondary,
                      background: active ? hexToRgba(color, 0.06) : C.surface,
                      transition: "all 150ms ease",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel>one line bio</FieldLabel>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. ex-engineer turned founder, building the tool I always needed..."
              style={{ ...darkTextarea, minHeight: 72 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <AmberButton onClick={save} disabled={saving}>
            That&rsquo;s me →
          </AmberButton>
          <SkipLink onClick={onComplete}>fill in later →</SkipLink>
        </div>
      </div>
    </ActionChapter>
  );
}
