"use client";

import type { OnboardingStepProps } from "./types";
import ExplainerLayout, { type ExplainerCardData } from "./ExplainerLayout";
import { useExplainerUnlock } from "./useExplainerUnlock";
import { C, MONO } from "./ui";

const CARDS: ExplainerCardData[] = [
  {
    label: "keeps your cohort in your corner",
    text: "They can't help if they don't know what's happening.",
    detail:
      "A weekly check-in keeps your cohort current on your business. The more they know, the sharper their advice when you need it most.",
  },
  {
    label: "accountability without pressure",
    text: "Saying what you're going to do makes you do it.",
    detail:
      "When founders commit to goals in front of peers who actually care, follow-through goes up. Not because they're watching — because you respect them.",
  },
  {
    label: "compounds your progress",
    text: "Small weekly wins stack into big momentum.",
    detail:
      "Founders who check in consistently move faster. Not because of the check-in itself — because the act of reflecting weekly forces clarity on what actually matters.",
  },
  {
    label: "takes under 3 minutes",
    text: "Three questions. That's it.",
    detail:
      "What did you ship? What are you focused on next? Where are you stuck? Answer those every week and your cohort always knows how to help you.",
  },
];

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const STREAKS = ["1 week", "2 weeks", "4 weeks", "4 weeks →"];

function weekHeader(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const week = Math.ceil(dayOfYear / 7);
  const monthYear = now.toLocaleString("en-US", { month: "long", year: "numeric" }).toLowerCase();
  return `WEEK_${String(week).padStart(2, "0")} — ${monthYear}`;
}

function CalendarVisual({ active }: { active: number | null }) {
  // Monday-first index of today (Mon=0 … Sun=6).
  const todayIdx = (new Date().getDay() + 6) % 7;
  const streak = active === null ? "—" : STREAKS[active];

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: 12 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, textAlign: "center", marginBottom: 10 }}>
        {weekHeader()}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ fontFamily: MONO, fontSize: 7, color: C.textDisabled, textAlign: "center" }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {DAY_LABELS.map((_, i) => {
          let bg: string = C.surface;
          let color: string = C.border;
          let glyph = "·";
          if (i < todayIdx) {
            bg = C.green;
            color = C.bg;
            glyph = "✓";
          } else if (i === todayIdx) {
            bg = C.amber;
            color = C.bg;
            glyph = "→";
          }
          return (
            <div
              key={i}
              style={{
                aspectRatio: "1 / 1",
                background: bg,
                color,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: MONO,
                fontSize: 9,
                border: i > todayIdx ? `1px solid ${C.border}` : "none",
              }}
            >
              {glyph}
            </div>
          );
        })}
      </div>

      <div style={{ fontFamily: MONO, fontSize: 10, color: C.textDisabled, marginTop: 12 }}>
        streak: <span style={{ color: C.amber }}>{streak}</span>
      </div>
    </div>
  );
}

export default function Step12_CheckinExplainer({
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
      eyebrow="// before your first check-in"
      heading="Why showing up weekly changes everything."
      cards={CARDS}
      ctaLabel="Got it — do my first check-in →"
      unlock={unlock}
      showDots
      visual={<CalendarVisual active={unlock.active} />}
    />
  );
}
