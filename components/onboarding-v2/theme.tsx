"use client";

// Shared design primitives for the cinematic-scroll onboarding (v2). Tokens
// mirror the Quorum design system exactly. Every value is an inline style with a
// literal hex — no Tailwind color approximations.

import type { CSSProperties, ReactNode } from "react";
import { useScrollReveal } from "./useScrollReveal";

// Font stacks — resolve the app's next/font CSS variables first, then fall back
// to the named family so text never flashes in a system serif mid-load.
export const MONO = 'var(--font-jetbrains-mono), "JetBrains Mono", ui-monospace, monospace';
export const SANS = 'var(--font-space-grotesk), "Space Grotesk", ui-sans-serif, system-ui, sans-serif';

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

// Stage → accent. Keyed by the DB value (series_a) and the hyphen form.
export const STAGE_COLORS: Record<string, string> = {
  idea: C.teal,
  "pre-seed": C.amber,
  seed: C.green,
  series_a: C.purple,
  "series-a": C.purple,
};

// Post / room type → accent, matching PostCard's identity stripe.
export const TYPE_COLORS: Record<string, string> = {
  decision: C.amber,
  question: C.blue,
  blocker: C.red,
  win: C.green,
};

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function stageLabel(stage?: string | null): string {
  if (!stage) return "founder";
  return stage === "series_a" ? "series a" : stage;
}

// ─── Inputs ──────────────────────────────────────────────────────────────────
// colorScheme + appearance reset prevents the white flash some browsers paint on
// form controls over a dark surface.
export const darkInput: CSSProperties = {
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

export const darkTextarea: CSSProperties = {
  ...darkInput,
  resize: "vertical",
  lineHeight: 1.6,
};

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label
      style={{
        fontFamily: MONO,
        fontSize: 10,
        color: C.textSecondary,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        marginBottom: 8,
        display: "block",
      }}
    >
      {children}
    </label>
  );
}

// ─── Scroll reveal wrappers ──────────────────────────────────────────────────

// Fade + rise a block in the first time it enters the viewport. `variant`
// chooses the motion: text/card use translateY, bubble uses scale.
export function Reveal({
  children,
  variant = "text",
  delay = 0,
  threshold = 0.2,
  style,
  as = "div",
}: {
  children: ReactNode;
  variant?: "text" | "card" | "bubble";
  delay?: number;
  threshold?: number;
  style?: CSSProperties;
  as?: "div" | "section";
}) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>(threshold);

  const hidden: CSSProperties =
    variant === "card"
      ? { opacity: 0, transform: "translateY(32px)" }
      : variant === "bubble"
        ? { opacity: 0, transform: "scale(0.95)" }
        : { opacity: 0, transform: "translateY(20px)" };

  const shown: CSSProperties = { opacity: 1, transform: "translateY(0) scale(1)" };

  const transition =
    variant === "card"
      ? "opacity 0.6s ease, transform 0.6s ease"
      : variant === "bubble"
        ? "opacity 0.4s ease, transform 0.4s ease"
        : "opacity 0.8s ease, transform 0.8s ease";

  const Tag = as;
  return (
    <Tag
      ref={ref}
      style={{
        transition,
        transitionDelay: `${delay}ms`,
        willChange: "opacity, transform",
        ...(isVisible ? shown : hidden),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

// A full-bleed scroll section. `min` controls how much breathing room the moment
// gets (text moments are tall; action cards can be shorter). Content is centered.
export function Section({
  id,
  children,
  min = "100vh",
  style,
}: {
  id?: string;
  children: ReactNode;
  min?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      id={id}
      style={{
        minHeight: min,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 20px",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

// Centered amber mono context line — the "// ..." cue above an action card.
export function ContextLine({
  children,
  color = C.textDisabled,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <Reveal>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 12,
          color,
          letterSpacing: "0.08em",
          textAlign: "center",
          ...style,
        }}
      >
        {children}
      </div>
    </Reveal>
  );
}

// The amber action-card submit button (full width, design-system amber).
export function AmberButton({
  children,
  onClick,
  disabled = false,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        background: C.amber,
        color: C.bg,
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.06em",
        padding: "14px 28px",
        border: "none",
        borderRadius: 4,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "opacity 200ms ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// The quiet "fill in later / skip for now" link beneath an action card.
export function SkipLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        margin: "12px auto 0",
        background: "transparent",
        border: "none",
        fontFamily: MONO,
        fontSize: 11,
        color: C.textDisabled,
        cursor: "pointer",
        textAlign: "center",
      }}
    >
      {children}
    </button>
  );
}

// Card header eyebrow — uppercase amber mono "// build your profile".
export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 10,
        color: C.amber,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginBottom: 24,
      }}
    >
      {children}
    </div>
  );
}
