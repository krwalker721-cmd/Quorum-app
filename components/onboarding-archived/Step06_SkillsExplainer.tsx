"use client";

import type { OnboardingStepProps } from "./types";
import CinematicShell from "./CinematicShell";
import { useCinematicBeats } from "./useCinematicBeats";
import { C, hexToRgba, MONO } from "./ui";

const BEATS = 3;

const CAPTIONS = [
  "Skills make you <span>findable</span> when it matters most.",
  "The right connection at the <span>right moment</span> can change everything.",
  "Give your expertise. <span>Get it back</span> when you need it.",
];

const SKILLS = [
  "fundraising", "product", "growth", "sales",
  "marketing", "engineering", "design", "hiring",
  "operations", "finance", "brand", "go-to-market",
];

// Beat 1 lights a meaningful handful; beat 2 lights them all.
const BEAT1_LIT = new Set([0, 1, 3, 5]); // fundraising, product, sales, engineering

function litSet(beat: number): Set<number> {
  if (beat >= 2) return new Set(SKILLS.map((_, i) => i));
  if (beat === 1) return BEAT1_LIT;
  return new Set();
}

function SkillsVisual({ beat }: { beat: number }) {
  const lit = litSet(beat);
  const showLines = beat >= 2;

  return (
    <div style={{ position: "relative", width: 210, margin: "0 auto" }}>
      {showLines && (
        <svg
          viewBox="0 0 210 116"
          preserveAspectRatio="none"
          aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}
        >
          <line x1="30" y1="18" x2="150" y2="58" stroke={hexToRgba(C.amber, 0.4)} strokeWidth="1" />
          <line x1="150" y1="58" x2="55" y2="100" stroke={hexToRgba(C.amber, 0.4)} strokeWidth="1" />
          <line x1="55" y1="100" x2="180" y2="34" stroke={hexToRgba(C.amber, 0.4)} strokeWidth="1" />
        </svg>
      )}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
        {SKILLS.map((skill, i) => {
          const on = lit.has(i);
          return (
            <span
              key={skill}
              style={{
                fontFamily: MONO,
                fontSize: 9,
                padding: "5px 10px",
                borderRadius: 3,
                border: `1px solid ${on ? C.amber : C.border}`,
                background: on ? hexToRgba(C.amber, 0.06) : C.surface,
                color: on ? C.amber : C.textDisabled,
                transition: "all 250ms ease",
              }}
            >
              {skill}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function Step06_SkillsExplainer({
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
      eyebrow="// what can you offer this room?"
      beats={BEATS}
      currentBeat={currentBeat}
      isComplete={isComplete}
      caption={currentBeat < 0 ? "" : CAPTIONS[beat]}
      onAdvance={advance}
      ctaLabel="Got it — pick my skills →"
      onCta={onNext}
      onStepBack={onBack}
    >
      <SkillsVisual beat={beat} />
    </CinematicShell>
  );
}
