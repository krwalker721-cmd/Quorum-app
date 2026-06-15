"use client";

import type { OnboardingStepProps } from "./types";
import ExplainerLayout, { type ExplainerCardData } from "./ExplainerLayout";
import { useExplainerUnlock } from "./useExplainerUnlock";
import { C, hexToRgba, MONO } from "./ui";

const CARDS: ExplainerCardData[] = [
  {
    label: "private by design",
    text: "12 vetted founders. One closed room.",
    detail:
      "No algorithms, no strangers. Every person was hand-selected. What's said here stays here.",
  },
  {
    label: "been where you are",
    text: "Real advice from people who've lived it.",
    detail:
      "Not theory. Founders who made the same mistakes and the same breakthroughs you're about to face.",
  },
  {
    label: "faster decisions",
    text: "Stop second-guessing. Start moving.",
    detail:
      "The biggest thing slowing your business down is decisions made in isolation. Post a problem, get real answers, move faster.",
  },
  {
    label: "compounds over time",
    text: "The longer you're in, the more valuable it gets.",
    detail:
      "Your cohort learns your business. They remember your context, your history, your goals — something no forum or cold advisor can do.",
  },
];

const NODE_LABELS = ["MR", "AL", "JP", "SK", "TN", "BK", "CL", "RV"];

const STATES = [
  { nodes: [0, 1, 2, 3], value: "4 / 8", sub: "founders visible to you" },
  { nodes: [0, 1, 2, 3, 4, 5, 6, 7], value: "8 / 8", sub: "have been through this" },
  { nodes: [0, 2, 4, 6], value: "2x", sub: "faster than deciding alone" },
  { nodes: [0, 1, 2, 3, 4, 5, 6, 7], value: "∞", sub: "context built over time" },
];
const BASE = { nodes: [] as number[], value: "0 / 8", sub: "your cohort" };

const CX = 80;
const CY = 80;
const R = 56;
const POS = NODE_LABELS.map((_, i) => {
  const a = ((-90 + i * 45) * Math.PI) / 180;
  return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
});

function CohortVisual({ active }: { active: number | null }) {
  const st = active === null ? BASE : STATES[active];
  const on = new Set(st.nodes);

  return (
    <div>
      <svg viewBox="0 0 160 160" style={{ width: "100%", display: "block" }} aria-hidden>
        {/* connector lines */}
        {POS.map((p, i) => (
          <line
            key={`l${i}`}
            x1={CX}
            y1={CY}
            x2={p.x}
            y2={p.y}
            stroke={on.has(i) ? hexToRgba(C.amber, 0.35) : C.border}
            strokeWidth="1"
          />
        ))}
        {/* outer nodes */}
        {POS.map((p, i) => {
          const lit = on.has(i);
          return (
            <g key={`n${i}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r={13}
                fill={lit ? hexToRgba(C.amber, 0.08) : C.surface}
                stroke={lit ? C.amber : C.borderMuted}
                strokeWidth="1"
                style={{ transition: "all 250ms ease" }}
              />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={MONO}
                fontSize="7"
                fill={lit ? C.amber : C.textSecondary}
              >
                {NODE_LABELS[i]}
              </text>
            </g>
          );
        })}
        {/* center node */}
        <circle cx={CX} cy={CY} r={18} fill={hexToRgba(C.amber, 0.12)} stroke={C.amber} strokeWidth="1.5" />
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" fontFamily={MONO} fontSize="8" fill={C.amber}>
          YOU
        </text>
      </svg>

      <div style={{ fontFamily: MONO, fontSize: 9, color: C.textDisabled, marginTop: 8 }}>
        // active connections
      </div>
      <div style={{ fontFamily: MONO, fontSize: 18, color: C.amber, marginTop: 2 }}>{st.value}</div>
      <div style={{ fontFamily: MONO, fontSize: 8, color: C.textDisabled, marginTop: 2 }}>{st.sub}</div>
    </div>
  );
}

export default function Step08_CohortExplainer({
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
      eyebrow="// before you meet them"
      heading="What is a cohort?"
      cards={CARDS}
      ctaLabel="Got it — show me my cohort →"
      unlock={unlock}
      showDots
      visual={<CohortVisual active={unlock.active} />}
    />
  );
}
