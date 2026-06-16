"use client";

import type { OnboardingStepProps } from "./types";
import CinematicShell from "./CinematicShell";
import { useCinematicBeats } from "./useCinematicBeats";
import { C, hexToRgba, MONO, SANS } from "./ui";

const BEATS = 3;

const CAPTIONS = [
  "Post a project. <span>Find co-builders.</span> Ship together.",
  "Post what you need. <span>The right person</span> is probably already here.",
  "Hire from people you <span>already trust.</span>",
];

interface CollabBeat {
  type: string;
  color: string;
  founder?: string;
  title: string;
  sub: string;
  skills: string[];
  cta: string;
}

const CARDS: CollabBeat[] = [
  {
    type: "project",
    color: C.blue,
    founder: "Marcus R.",
    title: "AI research tool",
    sub: "looking for a technical co-builder",
    skills: ["engineering", "ai/ml"],
    cta: "join →",
  },
  {
    type: "need",
    color: C.purple,
    title: "need: brand designer",
    sub: "launching in 6 weeks, B2B experience",
    skills: ["design", "brand"],
    cta: "message →",
  },
  {
    type: "hiring",
    color: C.green,
    title: "first sales hire",
    sub: "seed stage, close and build process",
    skills: ["sales", "gtm"],
    cta: "connect →",
  },
];

function CollabCard({ data }: { data: CollabBeat }) {
  return (
    <div
      style={{
        width: 200,
        margin: "0 auto",
        background: C.surface,
        borderLeft: `2px solid ${data.color}`,
        borderRadius: "0 4px 4px 0",
        padding: "12px 14px",
        textAlign: "left",
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 8, color: data.color }}>// {data.type}</div>

      {data.founder && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "7px 0" }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: `1px solid ${data.color}`,
              background: hexToRgba(data.color, 0.14),
            }}
          />
          <span style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted }}>{data.founder}</span>
        </div>
      )}

      <div style={{ fontFamily: SANS, fontSize: 12, color: C.textPrimary, marginTop: data.founder ? 0 : 7 }}>
        {data.title}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 10, color: C.textSecondary, marginTop: 3 }}>{data.sub}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9 }}>
        {data.skills.map((sk) => (
          <span
            key={sk}
            style={{
              fontFamily: MONO,
              fontSize: 7,
              padding: "2px 5px",
              borderRadius: 2,
              border: `1px solid ${C.border}`,
              color: C.textMuted,
            }}
          >
            {sk}
          </span>
        ))}
        <span style={{ fontFamily: MONO, fontSize: 8, color: data.color, marginLeft: "auto" }}>{data.cta}</span>
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
  const { currentBeat, isComplete, advance } = useCinematicBeats(BEATS);
  const beat = Math.max(0, currentBeat);

  return (
    <CinematicShell
      currentStep={currentStep}
      totalSteps={totalSteps}
      eyebrow="// before you explore"
      beats={BEATS}
      currentBeat={currentBeat}
      isComplete={isComplete}
      caption={currentBeat < 0 ? "" : CAPTIONS[beat]}
      onAdvance={advance}
      ctaLabel="Got it — explore the collab board →"
      onCta={onNext}
      onStepBack={onBack}
    >
      <CollabCard data={CARDS[beat]} />
    </CinematicShell>
  );
}
