"use client";

import type { OnboardingStepProps } from "./types";
import { C, Eyebrow, Heading, MONO, PrimaryButton, SANS, StepFrame } from "./ui";

const PILLARS = [
  {
    color: C.amber,
    label: "same mindset",
    text: "Founders who think the way you do. No noise, no tourists.",
  },
  {
    color: C.green,
    label: "been there",
    text: "People who've already faced what you're facing right now.",
  },
  {
    color: C.blue,
    label: "tells the truth",
    text: "Honest answers. Not what you want to hear — what you need.",
  },
];

export default function Step02_Mirror({ onNext, onBack, currentStep, totalSteps }: OnboardingStepProps) {
  return (
    <StepFrame currentStep={currentStep} totalSteps={totalSteps} onBack={onBack}>
      <Eyebrow>// that&rsquo;s exactly why we built this</Eyebrow>

      <div style={{ fontFamily: MONO, fontSize: 13, color: C.textSecondary, marginBottom: 12 }}>
        → you said it. we heard it.
      </div>

      <Heading size={30} maxWidth={600}>
        That&rsquo;s <span style={{ color: C.amber }}>Quorum.</span> A private network of founders
        with the same drive as you — who&rsquo;ve already been where you&rsquo;re going.
      </Heading>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          maxWidth: 540,
          marginTop: 28,
        }}
      >
        {PILLARS.map((p) => (
          <div
            key={p.label}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderTop: `2px solid ${p.color}`,
              borderRadius: 4,
              padding: 16,
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: C.textDisabled,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 8,
              }}
            >
              {p.label}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
              {p.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        <PrimaryButton onClick={onNext}>Show me what&rsquo;s inside →</PrimaryButton>
      </div>
    </StepFrame>
  );
}
