"use client";

import type { CSSProperties, ReactNode } from "react";
import OnboardingShell from "./OnboardingShell";
import { C, hexToRgba, MONO } from "./ui";

// Shared chrome for the six cinematic explainer screens. The whole content area
// is the advance affordance (click anywhere); scroll/keyboard are wired by
// useCinematicBeats. Caption + visual crossfade on each beat; once complete the
// "click or scroll" hint is replaced by the CTA.
//
// Keyframes are injected locally (rather than in globals.css) so the whole
// pattern stays self-contained within components/onboarding/.
export interface CinematicShellProps {
  currentStep: number;
  totalSteps: number;
  eyebrow: string;
  beats: number;
  currentBeat: number;
  isComplete: boolean;
  // Caption for the active beat — an HTML string; <span> renders amber.
  caption: string;
  onAdvance: () => void;
  ctaLabel: string;
  onCta: () => void;
  children: ReactNode; // the per-beat visual (220 × 190 area)
  // Leave the screen for the previous step. Beat-level back is handled by the
  // hook (scroll up / ←); this is the explicit "exit backward" affordance.
  onStepBack?: () => void;
}

const KEYFRAMES = `
@keyframes cinFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes cinCaptionIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes cinVisualIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes cinHintIn { from { opacity: 0; } to { opacity: 1; } }
.cin-caption span { color: ${C.amber}; }
`;

export default function CinematicShell({
  currentStep,
  totalSteps,
  eyebrow,
  beats,
  currentBeat,
  isComplete,
  caption,
  onAdvance,
  ctaLabel,
  onCta,
  children,
  onStepBack,
}: CinematicShellProps) {
  const started = currentBeat >= 0;

  return (
    <OnboardingShell currentStep={currentStep} totalSteps={totalSteps}>
      <style>{KEYFRAMES}</style>

      <div
        onClick={isComplete ? undefined : onAdvance}
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "40px 60px",
          cursor: isComplete ? "default" : "pointer",
          userSelect: "none",
        }}
      >
        {onStepBack && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStepBack();
            }}
            style={{
              position: "absolute",
              top: 20,
              left: 24,
              background: "transparent",
              border: "none",
              color: C.textDisabled,
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.06em",
              cursor: "pointer",
              padding: 0,
            }}
          >
            ← back
          </button>
        )}

        {/* Eyebrow */}
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: C.amber,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 22,
            animation: "cinFadeIn 600ms ease both",
          }}
        >
          {eyebrow}
        </div>

        {/* Beat indicator dots */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          {Array.from({ length: beats }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 28,
                height: 2,
                borderRadius: 1,
                background:
                  i < currentBeat ? C.borderMuted : i === currentBeat ? C.amber : C.border,
                transition: "background 500ms ease",
              }}
            />
          ))}
        </div>

        {/* Visual area — crossfades per beat */}
        <div
          style={{
            width: 220,
            height: 190,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 30,
          }}
        >
          <div
            key={`v${currentBeat}`}
            style={{
              width: "100%",
              animation: started ? "cinVisualIn 600ms ease 150ms both" : undefined,
              opacity: started ? undefined : 0,
            }}
          >
            {children}
          </div>
        </div>

        {/* Caption */}
        <div
          key={`c${currentBeat}`}
          className="cin-caption"
          dangerouslySetInnerHTML={{ __html: caption }}
          style={{
            fontFamily: "var(--font-space-grotesk), \"Space Grotesk\", ui-sans-serif, system-ui, sans-serif",
            fontSize: 22,
            fontWeight: 500,
            color: C.textPrimary,
            lineHeight: 1.4,
            maxWidth: 380,
            minHeight: 62,
            animation: started ? "cinCaptionIn 600ms ease both" : undefined,
            opacity: started ? undefined : 0,
          }}
        />

        {/* Hint → CTA */}
        <div style={{ marginTop: 26, minHeight: 48, display: "flex", alignItems: "center" }}>
          {isComplete ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCta();
              }}
              style={ctaStyle}
            >
              {ctaLabel}
            </button>
          ) : (
            started && (
              <span
                key={`h${currentBeat}`}
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: C.borderMuted,
                  letterSpacing: "0.06em",
                  animation: "cinHintIn 600ms ease 900ms both",
                }}
              >
                click or scroll to continue ↓
              </span>
            )
          )}
        </div>
      </div>
    </OnboardingShell>
  );
}

const ctaStyle: CSSProperties = {
  background: "transparent",
  color: C.amber,
  fontFamily: MONO,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.06em",
  padding: "14px 28px",
  border: `1px solid ${hexToRgba(C.amber, 0.5)}`,
  borderRadius: 6,
  cursor: "pointer",
  animation: "cinFadeIn 500ms ease both",
};
