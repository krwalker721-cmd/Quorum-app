"use client";

import type { OnboardingStepProps } from "./types";
import ExplainerLayout, { type ExplainerCardData } from "./ExplainerLayout";
import { useExplainerUnlock } from "./useExplainerUnlock";
import { C, hexToRgba, MONO, SANS, TYPE_COLORS } from "./ui";

const CARDS: ExplainerCardData[] = [
  {
    label: "be real, not polished",
    text: "Vulnerability here is a strength.",
    detail:
      "This isn't LinkedIn. Nobody here is performing. The more honest your post, the better the answer. Your cohort can only help with what you actually share.",
  },
  {
    label: "your problem is not unique",
    text: "Someone in this room has been here before.",
    detail:
      "Whatever you're facing — hiring, fundraising, strategy, co-founder conflict — someone in your cohort has navigated it. Post it and find out who.",
  },
  {
    label: "faster than figuring it out alone",
    text: "One post can save you weeks of doubt.",
    detail:
      "The decision you've been sitting on for two weeks could be resolved in a single thread. That's the compounding value of having the right room behind you.",
  },
  {
    label: "we already know your challenge",
    text: "Your first post is already seeded.",
    detail:
      "Remember what you told us earlier? We've turned that into your first post. All you have to do is refine it and send it to your cohort.",
  },
];

interface PostState {
  type: keyof typeof TYPE_COLORS;
  body: string;
  reply: string;
  replied: boolean;
}

const STATES: PostState[] = [
  {
    type: "decision",
    body: "I need to decide whether to raise a round or stay lean...",
    reply: "waiting for replies...",
    replied: false,
  },
  {
    type: "question",
    body: "Has anyone here navigated hiring their first sales hire?",
    reply: "waiting for replies...",
    replied: false,
  },
  {
    type: "blocker",
    body: "Been stuck on this pricing decision for 2 weeks. Need a gut check.",
    reply: "3 founders replied · 2 min ago",
    replied: true,
  },
  {
    type: "decision",
    body: "What's the hardest part where I am that I haven't figured out yet...",
    reply: "your cohort is ready to help →",
    replied: true,
  },
];
const BASE: PostState = {
  type: "decision",
  body: "your first post will look like this",
  reply: "tap a card →",
  replied: false,
};

function PostVisual({ active }: { active: number | null }) {
  const s = active === null ? BASE : STATES[active];
  const color = TYPE_COLORS[s.type];

  return (
    <div
      style={{
        background: C.surface,
        borderLeft: `2px solid ${color}`,
        borderRadius: "0 4px 4px 0",
        padding: 12,
        transition: "border-color 250ms ease",
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 8, color, marginBottom: 8 }}>// {s.type}</div>
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
      <div style={{ fontFamily: SANS, fontSize: 11, color: C.textSecondary, lineHeight: 1.45, marginBottom: 10 }}>
        {s.body}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 8, color: s.replied ? C.green : C.textDisabled }}>
        {s.reply}
      </div>
    </div>
  );
}

export default function Step10_FirstPostExplainer({
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
      eyebrow="// before your first post"
      heading="Why posting is the whole point."
      cards={CARDS}
      ctaLabel="Got it — make my first post →"
      unlock={unlock}
      visual={<PostVisual active={unlock.active} />}
    />
  );
}
