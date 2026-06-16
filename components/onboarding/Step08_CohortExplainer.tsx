"use client";

import type { OnboardingStepProps } from "./types";
import CinematicShell from "./CinematicShell";
import { useCinematicBeats } from "./useCinematicBeats";
import { C, hexToRgba, MONO, SANS } from "./ui";

const BEATS = 3;

const CAPTIONS = [
  "12 founders. <span>One private room.</span>",
  "People who've <span>already solved</span> what you're about to face.",
  "Post a problem. <span>Get a real answer.</span> Move faster.",
];

const NODE_LABELS = ["MR", "AL", "JP", "SK", "TN", "BK", "CL", "RV"];
const CX = 95;
const CY = 95;
const R = 66;
const POS = NODE_LABELS.map((_, i) => {
  const a = ((-90 + i * 45) * Math.PI) / 180;
  return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
});

function Ring({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 190 190" style={{ width: 190, display: "block", margin: "0 auto" }} aria-hidden>
      {POS.map((p, i) => (
        <line
          key={`l${i}`}
          x1={CX}
          y1={CY}
          x2={p.x}
          y2={p.y}
          stroke={lit ? hexToRgba(C.amber, 0.4) : C.border}
          strokeWidth="1"
          style={{ transition: "stroke 250ms ease" }}
        />
      ))}
      {POS.map((p, i) => (
        <g
          key={`n${i}`}
          style={{ animation: !lit ? "cinFadeIn 400ms ease both" : undefined, animationDelay: !lit ? `${i * 90}ms` : undefined }}
        >
          <circle
            cx={p.x}
            cy={p.y}
            r={15}
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
            fontSize="7.5"
            fill={lit ? C.amber : C.textDisabled}
          >
            {NODE_LABELS[i]}
          </text>
        </g>
      ))}
      <circle cx={CX} cy={CY} r={20} fill={hexToRgba(C.amber, 0.12)} stroke={C.amber} strokeWidth="1.5" />
      <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" fontFamily={MONO} fontSize="8.5" fill={C.amber}>
        YOU
      </text>
    </svg>
  );
}

function PostCard() {
  return (
    <div style={{ width: 210, margin: "0 auto", textAlign: "left" }}>
      <div
        style={{
          background: C.surface,
          borderLeft: `2px solid ${C.amber}`,
          borderRadius: "0 4px 4px 0",
          padding: "12px 14px",
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 8, color: C.amber, marginBottom: 8 }}>// decision</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              border: `1px solid ${C.amber}`,
              background: hexToRgba(C.amber, 0.12),
              color: C.amber,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: MONO,
              fontSize: 8,
            }}
          >
            YO
          </div>
          <span style={{ fontFamily: MONO, fontSize: 8, color: C.textSecondary }}>you · just now</span>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 11, color: C.textSecondary, lineHeight: 1.45 }}>
          Should I raise now or stay lean for 6 more months?
        </div>
      </div>

      <div
        style={{
          background: C.bg,
          borderLeft: `1px solid ${C.green}`,
          padding: "10px 12px",
          marginLeft: 14,
          marginTop: 8,
          animation: "cinCaptionIn 600ms ease 700ms both",
        }}
      >
        <div style={{ fontFamily: SANS, fontSize: 10, color: C.green, lineHeight: 1.45, marginBottom: 6 }}>
          Faced this at pre-seed. Stay lean until PMF.
        </div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: C.textDisabled }}>Marcus R. · seed · 2 min ago</div>
      </div>
    </div>
  );
}

function CohortVisual({ beat }: { beat: number }) {
  if (beat >= 2) return <PostCard />;
  return <Ring lit={beat >= 1} />;
}

export default function Step08_CohortExplainer({
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
      eyebrow="// before you meet them"
      beats={BEATS}
      currentBeat={currentBeat}
      isComplete={isComplete}
      caption={currentBeat < 0 ? "" : CAPTIONS[beat]}
      onAdvance={advance}
      ctaLabel="Got it — show me my cohort →"
      onCta={onNext}
      onStepBack={onBack}
    >
      <CohortVisual beat={beat} />
    </CinematicShell>
  );
}
