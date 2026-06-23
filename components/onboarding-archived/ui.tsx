"use client";

// Shared design primitives for the onboarding flow. Every step composes these so
// the 15 screens stay visually consistent and the per-step files can focus on
// their unique content. Tokens mirror the Quorum design system exactly.

import type { CSSProperties, ReactNode } from "react";
import OnboardingShell from "./OnboardingShell";

// Font stacks — resolve the app's next/font CSS variables first, then fall back
// to the named family so text never renders in a system serif mid-load.
export const MONO = 'var(--font-jetbrains-mono), "JetBrains Mono", ui-monospace, monospace';
export const SANS = 'var(--font-space-grotesk), "Space Grotesk", ui-sans-serif, system-ui, sans-serif';

// Palette
export const C = {
  bg: "#0d1117",
  surface: "#161b22",
  elevated: "#1c2128",
  border: "#21262d",
  borderMuted: "#30363d",
  textPrimary: "#e6edf3",
  textSecondary: "#8b949e",
  textMuted: "#6e7681",
  textDisabled: "#484f58",
  amber: "#f59e0b",
  green: "#22c55e",
  blue: "#58a6ff",
  red: "#f85149",
  purple: "#a78bfa",
  teal: "#38bdf8",
} as const;

// Stage → accent color. Keyed by both the DB value (series_a) and the hyphen
// form the UI sometimes uses (series-a), so either lookup resolves.
export const STAGE_COLORS: Record<string, string> = {
  idea: C.teal,
  "pre-seed": C.amber,
  seed: C.green,
  series_a: C.purple,
  "series-a": C.purple,
};

// Post / room type → accent color, matching PostCard's permanent identity stripe.
export const TYPE_COLORS: Record<string, string> = {
  decision: C.amber,
  question: C.blue,
  blocker: C.red,
  win: C.green,
};

// #rrggbb → rgba() at the given alpha. Used for the soft tinted fills/borders
// that recur across the flow (stage pills, type tints, active states).
export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Friendly stage label — the DB stores `series_a`, the UI shows "series a".
export function stageLabel(stage?: string | null): string {
  if (!stage) return "founder";
  return stage === "series_a" ? "series a" : stage;
}

// ─── Frame: shell + padded body + optional back affordance ──────────────────
export function StepFrame({
  currentStep,
  totalSteps,
  onBack,
  children,
  bodyStyle,
}: {
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  children: ReactNode;
  bodyStyle?: CSSProperties;
}) {
  return (
    <OnboardingShell currentStep={currentStep} totalSteps={totalSteps}>
      {/* Center the content column on wide screens instead of letting it hug the
       * left edge. The inner column keeps the 32px/60px body padding. */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", width: "100%" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 820,
            padding: "32px 60px",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            ...bodyStyle,
          }}
        >
          {onBack && <BackButton onBack={onBack} />}
          {children}
        </div>
      </div>
    </OnboardingShell>
  );
}

export function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      style={{
        alignSelf: "flex-start",
        background: "transparent",
        border: "none",
        color: C.textDisabled,
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: "0.06em",
        cursor: "pointer",
        padding: 0,
        marginBottom: 22,
      }}
    >
      ← back
    </button>
  );
}

// ─── Text primitives ────────────────────────────────────────────────────────
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 10,
        color: C.amber,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

export function Heading({
  children,
  size = 26,
  maxWidth = 620,
}: {
  children: ReactNode;
  size?: number;
  maxWidth?: number;
}) {
  return (
    <h1
      style={{
        fontFamily: SANS,
        fontSize: size,
        fontWeight: 600,
        color: C.textPrimary,
        lineHeight: 1.3,
        margin: 0,
        maxWidth,
      }}
    >
      {children}
    </h1>
  );
}

// Amber mono cue with a pulsing dot — the "tap each card to find out" instruction.
export function PulseHint({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 11,
        color: C.amber,
        letterSpacing: "0.06em",
        margin: "18px 0",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: C.amber,
          animation: "pulse 1.2s infinite",
        }}
      />
      {children}
    </div>
  );
}

// Quiet amber mono hint (no dot) — the "// ..." lines under form headings.
export function MonoHint({
  children,
  color = C.amber,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 11,
        color,
        letterSpacing: "0.06em",
        margin: "14px 0 18px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Left-border explanatory callout.
export function InfoBlock({
  children,
  maxWidth = 520,
}: {
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      style={{
        background: C.surface,
        borderLeft: `2px solid ${C.amber}`,
        padding: "12px 16px",
        maxWidth,
        marginBottom: 20,
        borderRadius: "0 4px 4px 0",
      }}
    >
      <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, margin: 0, fontFamily: SANS }}>
        {children}
      </p>
    </div>
  );
}

export function Emphasis({ children }: { children: ReactNode }) {
  return <strong style={{ color: C.textPrimary, fontWeight: 500 }}>{children}</strong>;
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 10,
        color: C.textSecondary,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

// ─── Buttons ────────────────────────────────────────────────────────────────
export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  locked = false,
  style,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  // locked dims to 0.3 and blocks pointer events (explainer gate), vs a plain
  // disabled which keeps layout but greys out.
  locked?: boolean;
  style?: CSSProperties;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || locked}
      style={{
        background: "transparent",
        color: C.amber,
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.06em",
        padding: "14px 28px",
        border: `1px solid ${hexToRgba(C.amber, 0.5)}`,
        borderRadius: 6,
        cursor: disabled || locked ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        opacity: locked ? 0.3 : disabled ? 0.5 : 1,
        pointerEvents: locked ? "none" : "auto",
        transition: "opacity 200ms ease, background 200ms ease, border-color 200ms ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        color: C.textDisabled,
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: "0.06em",
        padding: "14px 0",
        border: "none",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// Thin vertical rule used between primary + ghost actions.
export function ActionDivider() {
  return <div style={{ width: 1, height: 20, background: C.border }} />;
}

// ─── Inputs ─────────────────────────────────────────────────────────────────
// Dark input/textarea styling — colorScheme + appearance reset prevents the
// white flash some browsers paint on form controls.
export const inputStyle: CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.textPrimary,
  fontFamily: SANS,
  fontSize: 14,
  padding: "12px 14px",
  outline: "none",
  colorScheme: "dark",
  WebkitAppearance: "none",
  appearance: "none",
  width: "100%",
  boxSizing: "border-box",
};

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  lineHeight: 1.6,
};
