"use client";

import type { OnboardingStepProps } from "./types";
import ExplainerLayout, { type ExplainerCardData } from "./ExplainerLayout";
import { useExplainerUnlock } from "./useExplainerUnlock";
import { C, hexToRgba, MONO, SANS, STAGE_COLORS, stageLabel } from "./ui";

const CARDS: ExplainerCardData[] = [
  {
    label: "first impressions",
    text: "Your profile is how your cohort meets you.",
    detail:
      "Before you post a single thing, founders are reading your profile. A specific, honest profile makes people want to engage with you.",
  },
  {
    label: "context unlocks help",
    text: "The more they know about you, the better the advice.",
    detail:
      "Generic advice is useless. When your cohort knows your stage, your business, and your background — their answers are actually relevant to you.",
  },
  {
    label: "builds your reputation",
    text: "Your trust score grows as you show up.",
    detail:
      "Quorum tracks how much you contribute. The more real and consistent you are, the more founders trust what you say — and the more they help you back.",
  },
  {
    label: "be specific",
    text: "Vague profiles get vague responses.",
    detail:
      '"Building a startup" tells nobody anything. "Building a B2B SaaS tool for construction teams at pre-seed" tells your cohort exactly where you are and how they can help.',
  },
];

interface ProfileState {
  building: string;
  stage: string | null;
  bio: string;
  trust: number;
  trustLabel: string;
}

const BASE: ProfileState = {
  building: "tell us what you're building",
  stage: null,
  bio: "—",
  trust: 0,
  trustLabel: "new here",
};

const OVERRIDES: Array<Partial<ProfileState>> = [
  { building: "building something new", stage: "pre-seed", bio: "still figuring it out", trust: 15 },
  { building: "B2B SaaS for construction", bio: "ex-operator turned founder", trust: 40 },
  { trust: 70, trustLabel: "trusted contributor" },
  { building: "B2B SaaS for construction teams", bio: "building the tool I always needed", trust: 85 },
];

function fold(active: number | null): ProfileState {
  let s = { ...BASE };
  if (active !== null) {
    for (let i = 0; i <= active; i++) s = { ...s, ...OVERRIDES[i] };
  }
  return s;
}

function ProfileVisual({ active }: { active: number | null }) {
  const s = fold(active);
  const stageColor = s.stage ? STAGE_COLORS[s.stage] ?? C.textMuted : C.textMuted;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: 16 }}>
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

      <div style={{ fontFamily: SANS, fontSize: 11, color: C.textSecondary, lineHeight: 1.4, marginBottom: 8 }}>
        {s.building}
      </div>

      <div style={{ marginBottom: 8 }}>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 9,
            padding: "2px 8px",
            borderRadius: 3,
            border: `1px solid ${hexToRgba(stageColor, 0.3)}`,
            background: hexToRgba(stageColor, 0.06),
            color: stageColor,
          }}
        >
          {s.stage ? stageLabel(s.stage) : "no stage yet"}
        </span>
      </div>

      <div style={{ fontFamily: SANS, fontSize: 10, color: C.textMuted, lineHeight: 1.4, marginBottom: 14 }}>
        {s.bio}
      </div>

      <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${s.trust}%`,
            background: C.amber,
            transition: "width 400ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </div>
      <div style={{ fontFamily: MONO, fontSize: 8, color: C.textDisabled, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        trust · {s.trustLabel}
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
  const unlock = useExplainerUnlock(CARDS.length);
  return (
    <ExplainerLayout
      currentStep={currentStep}
      totalSteps={totalSteps}
      onBack={onBack}
      onNext={onNext}
      eyebrow="// before you build your profile"
      heading="Why your profile matters."
      cards={CARDS}
      ctaLabel="Got it — build my profile →"
      unlock={unlock}
      showDots
      visual={<ProfileVisual active={unlock.active} />}
    />
  );
}
