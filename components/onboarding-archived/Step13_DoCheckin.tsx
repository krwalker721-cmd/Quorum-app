"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingStepProps } from "./types";
import {
  Eyebrow,
  FieldLabel,
  GhostButton,
  Heading,
  MonoHint,
  PrimaryButton,
  StepFrame,
  textareaStyle,
} from "./ui";

export default function Step13_DoCheckin({
  onNext,
  onBack,
  currentStep,
  totalSteps,
}: OnboardingStepProps) {
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
    onNext();
  }

  const questions = [
    {
      label: "what did you ship or make progress on this week?",
      value: shipped,
      set: setShipped,
      placeholder: "e.g. shipped the onboarding flow, closed two discovery calls...",
    },
    {
      label: "what are you focused on next week?",
      value: focus,
      set: setFocus,
      placeholder: "e.g. hire my first engineer, lock in pricing strategy...",
    },
    {
      label: "where are you stuck right now?",
      value: stuck,
      set: setStuck,
      placeholder: "e.g. can't decide between two pricing models...",
    },
  ];

  return (
    <StepFrame currentStep={currentStep} totalSteps={totalSteps} onBack={onBack}>
      <Eyebrow>// climax — your weekly check-in</Eyebrow>
      <Heading>Your first check-in.</Heading>
      <MonoHint>// takes under 3 minutes — do this every week</MonoHint>

      <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 18 }}>
        {questions.map((q) => (
          <div key={q.label}>
            <FieldLabel>{q.label}</FieldLabel>
            <textarea
              value={q.value}
              onChange={(e) => q.set(e.target.value)}
              placeholder={q.placeholder}
              style={{ ...textareaStyle, minHeight: 72 }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 24 }}>
        <PrimaryButton onClick={submit} disabled={saving}>
          Submit my check-in →
        </PrimaryButton>
        <GhostButton onClick={onNext}>skip for now →</GhostButton>
      </div>
    </StepFrame>
  );
}
