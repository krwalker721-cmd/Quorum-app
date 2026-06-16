"use client";

import type { OnboardingStepProps } from "./types";
import CinematicShell from "./CinematicShell";
import { useCinematicBeats } from "./useCinematicBeats";
import { C, hexToRgba, MONO, SANS } from "./ui";

const BEATS = 3;

const CAPTIONS = [
  "Your profile is how your cohort <span>meets you</span> before you say a word.",
  "The more specific you are, the <span>better the help</span> you get.",
  "Show up consistently. <span>Build trust.</span> Get more back.",
];

function ProfileVisual({ beat }: { beat: number }) {
  const filled = beat >= 1;
  const trust = beat >= 2 ? 72 : 0;

  const dim = (on: boolean) => (on ? C.textSecondary : C.textDisabled);

  return (
    <div
      style={{
        width: 190,
        margin: "0 auto",
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        padding: 16,
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `1.5px solid ${C.amber}`,
            background: hexToRgba(C.amber, 0.12),
            color: C.amber,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: MONO,
            fontSize: 12,
          }}
        >
          YO
        </div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: C.textPrimary }}>You</div>
      </div>

      <div
        style={{
          fontFamily: SANS,
          fontSize: 11,
          color: dim(filled),
          lineHeight: 1.4,
          marginBottom: 10,
          transition: "color 300ms ease",
        }}
      >
        {filled ? "B2B SaaS for construction teams" : "what are you building?"}
      </div>

      <div style={{ marginBottom: 10 }}>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 9,
            padding: "2px 8px",
            borderRadius: 3,
            border: `1px solid ${filled ? hexToRgba(C.amber, 0.4) : C.border}`,
            background: filled ? hexToRgba(C.amber, 0.06) : C.surface,
            color: filled ? C.amber : C.textDisabled,
            transition: "all 300ms ease",
          }}
        >
          {filled ? "pre-seed" : "your stage"}
        </span>
      </div>

      <div
        style={{
          fontFamily: SANS,
          fontSize: 10,
          color: dim(filled),
          lineHeight: 1.4,
          marginBottom: 14,
          transition: "color 300ms ease",
        }}
      >
        {filled ? "ex-engineer turned founder" : "one line bio"}
      </div>

      <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${trust}%`,
            background: C.amber,
            transition: "width 700ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 9,
          color: C.textDisabled,
          marginTop: 6,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        trust score — {trust}
      </div>
    </div>
  );
}

export default function Step04_ProfileExplainer({
  onNext,
  onBack,
  currentStep,
  totalSteps,
}: OnboardingStepProps) {
  const { currentBeat, isComplete, advance } = useCinematicBeats(BEATS);
  const beat = Math.max(0, currentBeat);

  return (
    <CinematicShell
      currentStep={currentStep}
      totalSteps={totalSteps}
      eyebrow="// before you build your profile"
      beats={BEATS}
      currentBeat={currentBeat}
      isComplete={isComplete}
      caption={currentBeat < 0 ? "" : CAPTIONS[beat]}
      onAdvance={advance}
      ctaLabel="Got it — build my profile →"
      onCta={onNext}
      onStepBack={onBack}
    >
      <ProfileVisual beat={beat} />
    </CinematicShell>
  );
}
