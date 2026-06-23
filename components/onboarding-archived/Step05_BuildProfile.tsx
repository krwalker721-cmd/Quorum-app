"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingStepProps } from "./types";
import {
  C,
  Eyebrow,
  FieldLabel,
  GhostButton,
  Heading,
  MONO,
  MonoHint,
  PrimaryButton,
  StepFrame,
  inputStyle,
  textareaStyle,
} from "./ui";

// Stored stage value ↔ display label. The DB enum uses `series_a`.
const STAGES = [
  { value: "idea", label: "idea", color: C.teal, bg: "rgba(56,189,248,0.06)" },
  { value: "pre-seed", label: "pre-seed", color: C.amber, bg: "rgba(245,158,11,0.06)" },
  { value: "seed", label: "seed", color: C.green, bg: "rgba(34,197,94,0.06)" },
  { value: "series_a", label: "series a", color: C.purple, bg: "rgba(167,139,250,0.06)" },
];

export default function Step05_BuildProfile({
  onNext,
  onBack,
  currentStep,
  totalSteps,
}: OnboardingStepProps) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [building, setBuilding] = useState("");
  const [stage, setStage] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveAndContinue() {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Only write fields the founder actually filled in, so a partial profile
        // never blanks out data captured at signup. (bio has no column yet.)
        const payload: Record<string, unknown> = {};
        const fullName = `${first.trim()} ${last.trim()}`.trim();
        if (fullName) payload.full_name = fullName;
        if (building.trim()) payload.what_they_are_building = building.trim();
        if (stage) payload.stage = stage;
        if (Object.keys(payload).length > 0) {
          await supabase.from("profiles").update(payload).eq("id", user.id);
        }
      }
    } catch {
      // best-effort — advancing matters more than the write succeeding
    }
    onNext();
  }

  return (
    <StepFrame currentStep={currentStep} totalSteps={totalSteps} onBack={onBack}>
      <Eyebrow>// climax — let your cohort know who you are</Eyebrow>
      <Heading>Build your profile.</Heading>
      <MonoHint>// the more real this is, the better your cohort can help you</MonoHint>

      <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <FieldLabel>first name</FieldLabel>
            <input
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="Keaton"
              style={inputStyle}
            />
          </div>
          <div>
            <FieldLabel>last name</FieldLabel>
            <input
              value={last}
              onChange={(e) => setLast(e.target.value)}
              placeholder="Clarke"
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <FieldLabel>what are you building?</FieldLabel>
          <input
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            placeholder="e.g. a private community for founders..."
            style={inputStyle}
          />
        </div>

        <div>
          <FieldLabel>stage</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STAGES.map((s) => {
              const active = stage === s.value;
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
                    border: `1px solid ${active ? s.color : C.border}`,
                    color: active ? s.color : C.textSecondary,
                    background: active ? s.bg : C.surface,
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
            style={{ ...textareaStyle, minHeight: 80 }}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 24 }}>
        <PrimaryButton onClick={saveAndContinue} disabled={saving}>
          That&rsquo;s me — looks good →
        </PrimaryButton>
        <GhostButton onClick={onNext}>fill in later →</GhostButton>
      </div>
    </StepFrame>
  );
}
