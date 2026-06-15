"use client";

import type { OnboardingStepProps } from "./types";
import ExplainerLayout, { type ExplainerCardData } from "./ExplainerLayout";
import { useExplainerUnlock } from "./useExplainerUnlock";
import { C, hexToRgba, MONO } from "./ui";

const CARDS: ExplainerCardData[] = [
  {
    label: "you're not just a profile",
    text: "Skills make you findable when it matters.",
    detail:
      "When a founder in your cohort needs exactly what you know, your skills surface you. The right connection at the right moment can change the trajectory of your business.",
  },
  {
    label: "better relationships",
    text: "The best connections are built on knowing what each other is good at.",
    detail:
      "Your skills tell the room where you can help and who can help you. That's the foundation of a real working relationship — not just a warm introduction.",
  },
  {
    label: "give and receive",
    text: "What you offer determines what you get back.",
    detail:
      "Founders who bring specific skills to the table get specific help in return. Generosity with your expertise compounds into trust that pays off when you need it most.",
  },
  {
    label: "be specific",
    text: "Specific skills unlock specific conversations.",
    detail:
      '"Marketing" is vague. "B2B content and SEO for early-stage SaaS" is a conversation starter. The more specific you are, the more useful you become to this room.',
  },
];

const SKILLS = [
  "fundraising", "product", "growth", "sales", "marketing",
  "engineering", "design", "hiring", "operations", "finance",
];
// Which skill indices each card lights up (cumulative).
const GROUPS: number[][] = [[0, 1, 2], [3, 4, 5], [6, 7, 8, 9], []];

function litSet(active: number | null): Set<number> {
  const s = new Set<number>();
  if (active !== null) {
    for (let i = 0; i <= active; i++) GROUPS[i].forEach((n) => s.add(n));
  }
  return s;
}

function SkillsVisual({ active }: { active: number | null }) {
  const lit = litSet(active);
  const showLines = active === 3;

  return (
    <div style={{ position: "relative" }}>
      {showLines && (
        <svg
          viewBox="0 0 170 150"
          preserveAspectRatio="none"
          aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}
        >
          <line x1="28" y1="18" x2="120" y2="70" stroke={hexToRgba(C.amber, 0.35)} strokeWidth="1" />
          <line x1="120" y1="70" x2="46" y2="124" stroke={hexToRgba(C.amber, 0.35)} strokeWidth="1" />
          <line x1="46" y1="124" x2="140" y2="30" stroke={hexToRgba(C.amber, 0.35)} strokeWidth="1" />
        </svg>
      )}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {SKILLS.map((skill, i) => {
          const on = lit.has(i);
          return (
            <span
              key={skill}
              style={{
                fontFamily: MONO,
                fontSize: 8,
                padding: "3px 6px",
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
  const unlock = useExplainerUnlock(CARDS.length);
  return (
    <ExplainerLayout
      currentStep={currentStep}
      totalSteps={totalSteps}
      onBack={onBack}
      onNext={onNext}
      eyebrow="// what can you offer this room?"
      heading="Why your skills matter."
      cards={CARDS}
      ctaLabel="Got it — pick my skills →"
      unlock={unlock}
      visual={<SkillsVisual active={unlock.active} />}
    />
  );
}
