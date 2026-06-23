"use client";

import type { OnboardingStepProps } from "./types";
import CinematicShell from "./CinematicShell";
import { useCinematicBeats } from "./useCinematicBeats";
import { C, hexToRgba, MONO, SANS } from "./ui";

const BEATS = 3;

const CAPTIONS = [
  "Three questions. <span>Under 3 minutes.</span> Every week.",
  "Your cohort stays current. <span>Their advice gets sharper.</span>",
  "Small weekly wins <span>stack into</span> big momentum.",
];

const QUESTIONS = [
  { label: "// shipped", color: C.green, q: "What did you ship?" },
  { label: "// next", color: C.amber, q: "What are you focused on?" },
  { label: "// stuck", color: C.red, q: "Where are you stuck?" },
];

const AVATAR_COLORS = [C.teal, C.amber, C.green];

function QuestionCards({ showAvatars }: { showAvatars: boolean }) {
  return (
    <div style={{ width: 196, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
      {QUESTIONS.map((item, i) => (
        <div
          key={item.label}
          style={{
            background: C.surface,
            borderLeft: `2px solid ${item.color}`,
            borderRadius: "0 3px 3px 0",
            padding: "8px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            textAlign: "left",
            animation: "cinCaptionIn 500ms ease both",
            animationDelay: `${i * 200}ms`,
          }}
        >
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, color: item.color, marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontFamily: SANS, fontSize: 10, color: C.textSecondary }}>{item.q}</div>
          </div>
          {showAvatars && (
            <div style={{ display: "flex", flexShrink: 0 }}>
              {AVATAR_COLORS.map((col, k) => (
                <span
                  key={col}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: `1px solid ${col}`,
                    background: hexToRgba(col, 0.18),
                    marginLeft: k === 0 ? 0 : -5,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const BAR_HEIGHTS = [34, 52, 70, 86, 100];

function MomentumChart() {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ height: 120, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12 }}>
        {BAR_HEIGHTS.map((h, i) => (
          <div
            key={i}
            style={{
              width: 22,
              height: `${h}%`,
              background: C.amber,
              borderRadius: "2px 2px 0 0",
              opacity: 0.55 + i * 0.09,
              animation: "cinCaptionIn 500ms ease both",
              animationDelay: `${i * 150}ms`,
            }}
          />
        ))}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 8, color: C.textDisabled, marginTop: 10, letterSpacing: "0.08em" }}>
        WEEK_01 → WEEK_05
      </div>
    </div>
  );
}

function CheckinVisual({ beat }: { beat: number }) {
  if (beat >= 2) return <MomentumChart />;
  return <QuestionCards showAvatars={beat >= 1} />;
}

export default function Step12_CheckinExplainer({
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
      eyebrow="// before your first check-in"
      beats={BEATS}
      currentBeat={currentBeat}
      isComplete={isComplete}
      caption={currentBeat < 0 ? "" : CAPTIONS[beat]}
      onAdvance={advance}
      ctaLabel="Got it — do my first check-in →"
      onCta={onNext}
      onStepBack={onBack}
    >
      <CheckinVisual beat={beat} />
    </CinematicShell>
  );
}
