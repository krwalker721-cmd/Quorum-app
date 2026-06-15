"use client";

import type { OnboardingStepProps } from "./types";
import ExplainerLayout, { type ExplainerCardData } from "./ExplainerLayout";
import { useExplainerUnlock } from "./useExplainerUnlock";
import { C, hexToRgba, MONO, SANS } from "./ui";

const CARDS: ExplainerCardData[] = [
  {
    label: "build things together",
    text: "Projects are where founders actually collaborate.",
    detail:
      "Post a project, find co-builders with the right skills, and work together in a private project room. Real output — not just conversation.",
  },
  {
    label: "post what you need",
    text: "The right person might already be in this network.",
    detail:
      "Need a designer, advisor, or technical partner? Post it. Founders here surface fast because they already know and trust each other.",
  },
  {
    label: "hire from people you trust",
    text: "Your next hire might be one degree away.",
    detail:
      "Hiring from a warm network beats cold recruiting every time. Founders here can vouch for candidates, make intros, or step in themselves.",
  },
  {
    label: "giving accelerates you too",
    text: "The founders who contribute most get the most back.",
    detail:
      "Helping someone solve a problem sharpens your own thinking — and builds the kind of trust that pays off when you need it most.",
  },
];

const TABS = ["projects", "needs", "hiring"];

const BOARD = [
  {
    type: "project",
    color: C.blue,
    founder: "marcus",
    title: "AI research tool",
    sub: "looking for a technical co-builder",
    skills: ["engineering", "ai/ml"],
    cta: "join →",
  },
  {
    type: "need",
    color: C.purple,
    founder: "kira",
    title: "need: brand designer",
    sub: "launching in 6 weeks, B2B experience",
    skills: ["design", "brand"],
    cta: "message →",
  },
  {
    type: "hiring",
    color: C.green,
    founder: "devon",
    title: "first sales hire",
    sub: "seed stage, close and build process",
    skills: ["sales", "gtm"],
    cta: "connect →",
  },
];

// Which board card each explainer card illuminates.
const BOARD_FOR_CARD = [0, 1, 2, 0];

function BoardVisual({ active }: { active: number | null }) {
  const litBoard = active === null ? null : BOARD_FOR_CARD[active];
  const activeTab = litBoard ?? 0;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: 10 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 12, borderBottom: `1px solid ${C.border}`, marginBottom: 10 }}>
        {TABS.map((tab, i) => {
          const on = i === activeTab;
          return (
            <div
              key={tab}
              style={{
                fontFamily: MONO,
                fontSize: 8,
                paddingBottom: 6,
                color: on ? C.textPrimary : C.textMuted,
                borderBottom: `1px solid ${on ? C.amber : "transparent"}`,
              }}
            >
              {tab}
            </div>
          );
        })}
      </div>

      {/* Board cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {BOARD.map((b, i) => {
          const lit = litBoard === i;
          return (
            <div
              key={b.title}
              style={{
                borderLeft: `2px solid ${b.color}`,
                borderRadius: "0 3px 3px 0",
                background: C.bg,
                padding: "8px 10px",
                opacity: litBoard === null ? 0.6 : lit ? 1 : 0.35,
                transition: "opacity 250ms ease",
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 7, color: b.color }}>// {b.type}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, margin: "5px 0" }}>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: `1px solid ${b.color}`,
                    background: hexToRgba(b.color, 0.12),
                  }}
                />
                <span style={{ fontFamily: MONO, fontSize: 7, color: C.textMuted }}>{b.founder}</span>
              </div>
              <div style={{ fontFamily: SANS, fontSize: 10, color: C.textPrimary }}>{b.title}</div>
              <div style={{ fontFamily: SANS, fontSize: 9, color: C.textSecondary, marginTop: 2 }}>{b.sub}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                {b.skills.map((sk) => (
                  <span
                    key={sk}
                    style={{
                      fontFamily: MONO,
                      fontSize: 6,
                      padding: "1px 4px",
                      borderRadius: 2,
                      border: `1px solid ${C.border}`,
                      color: C.textMuted,
                    }}
                  >
                    {sk}
                  </span>
                ))}
                <span style={{ fontFamily: MONO, fontSize: 7, color: C.amber, marginLeft: "auto" }}>{b.cta}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Step14_CollabExplainer({
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
      eyebrow="// before you explore"
      heading="Where work actually gets done."
      instruction="tap each card to explore what's inside"
      cards={CARDS}
      ctaLabel="Got it — explore the collab board →"
      unlock={unlock}
      visual={<BoardVisual active={unlock.active} />}
      visualWidth={190}
      rowMaxWidth={580}
    />
  );
}
