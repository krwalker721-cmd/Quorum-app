"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingStepProps } from "./types";
import {
  C,
  Eyebrow,
  GhostButton,
  Heading,
  InfoBlock,
  MONO,
  MonoHint,
  PrimaryButton,
  StepFrame,
  inputStyle,
} from "./ui";

const DEFAULT_SKILLS = [
  "fundraising", "product", "growth", "sales", "marketing", "engineering", "design",
  "hiring", "operations", "finance", "legal", "partnerships", "go-to-market", "brand",
  "content", "community", "ai/ml", "b2b saas", "consumer", "hardware",
];

export default function Step07_PickSkills({
  onNext,
  onBack,
  currentStep,
  totalSteps,
}: OnboardingStepProps) {
  const [extra, setExtra] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  const allSkills = [...DEFAULT_SKILLS, ...extra];

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

  async function saveAndContinue() {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && selected.size > 0) {
        // skills is a text[] on profiles — tolerate the column not existing yet.
        await supabase.from("profiles").update({ skills: Array.from(selected) }).eq("id", user.id);
      }
    } catch {
      // best-effort
    }
    onNext();
  }

  const count = selected.size;

  return (
    <StepFrame currentStep={currentStep} totalSteps={totalSteps} onBack={onBack}>
      <Eyebrow>// what can you offer this room?</Eyebrow>
      <Heading>Pick your skills.</Heading>

      <div style={{ marginTop: 18 }}>
        <InfoBlock>
          The best connections here aren&rsquo;t random — they&rsquo;re built on knowing what each
          other is good at. Your skills tell the room where you can help and who can help you.
        </InfoBlock>
      </div>

      <MonoHint>// select all that apply — you can always update these later</MonoHint>

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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 520 }}>
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
                background: active ? "rgba(245,158,11,0.06)" : C.surface,
                color: active ? C.amber : C.textSecondary,
                transition: "all 150ms ease",
              }}
            >
              {skill}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, maxWidth: 520, marginTop: 16 }}>
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
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={addCustom}
          style={{
            fontFamily: MONO,
            fontSize: 14,
            background: C.surface,
            border: `1px solid ${C.border}`,
            color: C.textSecondary,
            padding: "10px 16px",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          +
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 24 }}>
        <PrimaryButton onClick={saveAndContinue} disabled={saving}>
          These are my strengths →
        </PrimaryButton>
        <GhostButton onClick={onNext}>skip for now →</GhostButton>
      </div>
    </StepFrame>
  );
}
