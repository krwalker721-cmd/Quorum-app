"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingStepProps } from "./types";
import { C, Eyebrow, GhostButton, Heading, MONO, MonoHint, SANS, StepFrame } from "./ui";

interface CollabCardData {
  type: string;
  color: string;
  title: string;
  sub: string;
  cta: string;
  href: string;
}

const CARDS: CollabCardData[] = [
  {
    type: "// project",
    color: C.blue,
    title: "Post a project",
    sub: "Find co-builders with the right skills and work together in a private room.",
    cta: "start a project →",
    href: "/collab?tab=projects&new=true",
  },
  {
    type: "// need",
    color: C.purple,
    title: "Post what you need",
    sub: "Tell the room what you're looking for — the right person might already be here.",
    cta: "post a need →",
    href: "/collab?tab=needs&new=true",
  },
  {
    type: "// hiring",
    color: C.green,
    title: "Find your next hire",
    sub: "Browse founders and their networks for warm candidates you can actually trust.",
    cta: "explore hiring →",
    href: "/collab?tab=needs",
  },
];

function CollabCard({ card, onPick }: { card: CollabCardData; onPick: (href: string) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={() => onPick(card.href)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderLeft: `2px solid ${card.color}`,
        borderRadius: "0 4px 4px 0",
        padding: 16,
        cursor: "pointer",
        boxShadow: hover ? `inset 2px 0 0 ${card.color}` : "none",
        transition: "box-shadow 150ms ease",
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 9, color: card.color, letterSpacing: "0.06em" }}>
        {card.type}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 14, color: C.textPrimary, margin: "8px 0 6px" }}>
        {card.title}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>
        {card.sub}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: card.color, marginTop: 12 }}>{card.cta}</div>
    </div>
  );
}

export default function Step15_ExploreCollab({ onBack, currentStep, totalSteps }: OnboardingStepProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function complete(target: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, current_step: totalSteps }),
      });
    } catch {
      // best-effort — still route the founder into the app
    }
    router.push(target);
  }

  return (
    <StepFrame currentStep={currentStep} totalSteps={totalSteps} onBack={onBack}>
      <Eyebrow>// climax — the collab board</Eyebrow>
      <Heading>Find someone to build with.</Heading>
      <MonoHint>// post a project, a need, or find your next hire</MonoHint>

      <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 12 }}>
        {CARDS.map((card) => (
          <CollabCard key={card.title} card={card} onPick={complete} />
        ))}
      </div>

      <div style={{ maxWidth: 520, display: "flex", justifyContent: "center", marginTop: 20 }}>
        <GhostButton onClick={() => complete("/collab")}>explore on my own →</GhostButton>
      </div>
    </StepFrame>
  );
}
