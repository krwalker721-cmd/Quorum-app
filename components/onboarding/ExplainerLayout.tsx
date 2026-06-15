"use client";

import type { ReactNode } from "react";
import { C, Eyebrow, Heading, MONO, PrimaryButton, PulseHint, StepFrame } from "./ui";
import ExplainerCard from "./ExplainerCard";
import type { ExplainerUnlock } from "./useExplainerUnlock";

export interface ExplainerCardData {
  label: string;
  text: string;
  detail: string;
}

// Shared scaffold for the six "tap each card to find out" explainer screens.
// The left column is a step-specific live visual; the right column is the card
// stack; the CTA below stays locked until all cards have been read. State lives
// in the parent (via useExplainerUnlock) so the parent can drive its own visual.
export interface ExplainerLayoutProps {
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  onNext: () => void;
  eyebrow: ReactNode;
  heading: ReactNode;
  instruction?: string;
  cards: ExplainerCardData[];
  ctaLabel: string;
  visual: ReactNode;
  visualWidth?: number;
  rowMaxWidth?: number;
  showDots?: boolean;
  unlock: ExplainerUnlock;
}

export default function ExplainerLayout({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  eyebrow,
  heading,
  instruction = "tap each card to find out",
  cards,
  ctaLabel,
  visual,
  visualWidth = 170,
  rowMaxWidth = 560,
  showDots = false,
  unlock,
}: ExplainerLayoutProps) {
  const { active, seen, selectCard, isUnlocked } = unlock;

  return (
    <StepFrame currentStep={currentStep} totalSteps={totalSteps} onBack={onBack}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading>{heading}</Heading>
      <PulseHint>{instruction}</PulseHint>

      <div style={{ display: "flex", gap: 28, maxWidth: rowMaxWidth, alignItems: "flex-start" }}>
        {/* Left — live visual + optional progress dots */}
        <div style={{ width: visualWidth, flexShrink: 0 }}>
          {visual}
          {showDots && (
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14 }}>
              {cards.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: i === active ? C.amber : seen.has(i) ? C.borderMuted : C.border,
                    transition: "background 200ms ease",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right — explainer cards */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {cards.map((card, i) => (
            <ExplainerCard
              key={card.label}
              label={card.label}
              text={card.text}
              detail={card.detail}
              isActive={active === i}
              isSeen={seen.has(i)}
              onClick={() => selectCard(i)}
            />
          ))}
        </div>
      </div>

      {/* Locked CTA */}
      <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 16 }}>
        <PrimaryButton onClick={onNext} locked={!isUnlocked}>
          {ctaLabel}
        </PrimaryButton>
        {!isUnlocked && (
          <span style={{ fontFamily: MONO, fontSize: 10, color: C.textDisabled, letterSpacing: "0.06em" }}>
            read all {cards.length} cards to continue
          </span>
        )}
      </div>
    </StepFrame>
  );
}
