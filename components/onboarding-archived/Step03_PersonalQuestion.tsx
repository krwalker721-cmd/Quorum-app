"use client";

import { useState } from "react";
import type { OnboardingStepProps } from "./types";
import {
  ActionDivider,
  C,
  Eyebrow,
  GhostButton,
  Heading,
  MONO,
  MonoHint,
  PrimaryButton,
  StepFrame,
  textareaStyle,
} from "./ui";

const MAX = 300;

export default function Step03_PersonalQuestion({
  onNext,
  onBack,
  currentStep,
  totalSteps,
  screen3Answer = "",
  setScreen3Answer,
}: OnboardingStepProps) {
  const [saving, setSaving] = useState(false);

  async function saveAndContinue() {
    setSaving(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screen3_answer: screen3Answer }),
      });
    } catch {
      // best-effort — the orchestrator also persists this on advance
    }
    onNext();
  }

  return (
    <StepFrame currentStep={currentStep} totalSteps={totalSteps} onBack={onBack}>
      <Eyebrow>// one honest question</Eyebrow>
      <Heading maxWidth={620}>
        What&rsquo;s the hardest part of where you are right now that you haven&rsquo;t been able
        to figure out yet?
      </Heading>
      <MonoHint>// this seeds your first post to your cohort — be real</MonoHint>

      <div style={{ maxWidth: 520 }}>
        <textarea
          value={screen3Answer}
          onChange={(e) => setScreen3Answer?.(e.target.value.slice(0, MAX))}
          maxLength={MAX}
          placeholder="e.g. figuring out how to hire my first sales person without burning through runway..."
          style={{ ...textareaStyle, minHeight: 120 }}
        />
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: C.borderMuted,
            textAlign: "right",
            marginTop: 6,
          }}
        >
          {screen3Answer.length} / {MAX}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 16 }}>
        <PrimaryButton onClick={saveAndContinue} disabled={saving}>
          That&rsquo;s my biggest challenge →
        </PrimaryButton>
        <ActionDivider />
        <GhostButton onClick={onNext}>skip for now →</GhostButton>
      </div>

      <div style={{ fontFamily: MONO, fontSize: 10, color: C.borderMuted, marginTop: 16 }}>
        // your answer stays private until you choose to post it
      </div>
    </StepFrame>
  );
}
