"use client";

import { useRef } from "react";
import { motion, useTransform, useMotionTemplate, type MotionValue } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll, GhostNumber } from "./sticky";
import { KineticHeading } from "./flair";
import { C, MONO, SANS, hexToRgba } from "./theme";

export type MotifKind =
  | "profile"
  | "skills"
  | "cohort"
  | "post"
  | "checkin"
  | "referral";

// ─── Bespoke motifs ──────────────────────────────────────────────────────────
// Each is a small graphic that assembles against the intro's scroll, themed to
// the step it introduces. All transform/opacity-driven.

function ProfileMotif({ progress, accent }: { progress: MotionValue<number>; accent: string }) {
  const dash = useTransform(progress, [0.2, 0.6], [264, 0]);
  const fade = useTransform(progress, [0.45, 0.6], [0, 1]);
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <motion.circle
        cx="60"
        cy="60"
        r="42"
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeDasharray="264"
        style={{ strokeDashoffset: dash }}
        opacity="0.7"
      />
      <motion.g style={{ opacity: fade }}>
        <circle cx="60" cy="48" r="13" fill="none" stroke={accent} strokeWidth="2" />
        <path
          d="M38 84 Q60 64 82 84"
          fill="none"
          stroke={accent}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </motion.g>
    </svg>
  );
}

const SKILL_TAGS = [
  { t: "fundraising", x: -120, y: -34, at: 0.18 },
  { t: "product", x: 96, y: -48, at: 0.26 },
  { t: "growth", x: -150, y: 26, at: 0.34 },
  { t: "design", x: 120, y: 22, at: 0.42 },
  { t: "go-to-market", x: -54, y: 58, at: 0.5 },
  { t: "hiring", x: 70, y: 60, at: 0.58 },
];
function SkillsMotif({ progress, accent }: { progress: MotionValue<number>; accent: string }) {
  return (
    <div style={{ position: "relative", width: 320, height: 160 }}>
      {SKILL_TAGS.map((s) => (
        <SkillTag key={s.t} s={s} progress={progress} accent={accent} />
      ))}
    </div>
  );
}
function SkillTag({
  s,
  progress,
  accent,
}: {
  s: (typeof SKILL_TAGS)[number];
  progress: MotionValue<number>;
  accent: string;
}) {
  const x = useTransform(progress, [s.at, s.at + 0.14], [s.x * 1.8, s.x]);
  const y = useTransform(progress, [s.at, s.at + 0.14], [s.y * 1.8, s.y]);
  const opacity = useTransform(progress, [s.at, s.at + 0.1], [0, 1]);
  const scale = useTransform(progress, [s.at, s.at + 0.14], [0.6, 1]);
  return (
    <motion.span
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        x,
        y,
        opacity,
        scale,
        translateX: "-50%",
        translateY: "-50%",
        fontFamily: MONO,
        fontSize: 11,
        whiteSpace: "nowrap",
        padding: "6px 12px",
        borderRadius: 4,
        border: `1px solid ${hexToRgba(accent, 0.4)}`,
        background: hexToRgba(accent, 0.08),
        color: accent,
        willChange: "transform, opacity",
      }}
    >
      {s.t}
    </motion.span>
  );
}

const COHORT_DOTS = Array.from({ length: 8 }, (_, i) => ({
  // scattered start, converge to a tidy arc
  sx: (i % 2 === 0 ? -1 : 1) * (60 + (i % 4) * 40),
  sy: (i < 4 ? -1 : 1) * (40 + (i % 3) * 26),
  ex: -110 + i * 31,
  ey: Math.sin(i * 0.8) * 14,
  at: 0.16 + i * 0.04,
}));
function CohortMotif({ progress, accent }: { progress: MotionValue<number>; accent: string }) {
  return (
    <div style={{ position: "relative", width: 320, height: 120 }}>
      {COHORT_DOTS.map((d, i) => (
        <CohortDot key={i} d={d} progress={progress} accent={accent} />
      ))}
    </div>
  );
}
function CohortDot({
  d,
  progress,
  accent,
}: {
  d: (typeof COHORT_DOTS)[number];
  progress: MotionValue<number>;
  accent: string;
}) {
  const x = useTransform(progress, [d.at, d.at + 0.4], [d.sx, d.ex]);
  const y = useTransform(progress, [d.at, d.at + 0.4], [d.sy, d.ey]);
  const opacity = useTransform(progress, [d.at, d.at + 0.1], [0, 1]);
  return (
    <motion.div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        x,
        y,
        opacity,
        width: 16,
        height: 16,
        marginLeft: -8,
        marginTop: -8,
        borderRadius: "50%",
        border: `1.5px solid ${accent}`,
        background: hexToRgba(accent, 0.18),
        willChange: "transform, opacity",
      }}
    />
  );
}

function PostMotif({ progress, accent }: { progress: MotionValue<number>; accent: string }) {
  const cardOpacity = useTransform(progress, [0.16, 0.26], [0, 1]);
  const cardY = useTransform(progress, [0.16, 0.26], [24, 0]);
  return (
    <motion.div
      style={{
        opacity: cardOpacity,
        y: cardY,
        width: 260,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderLeft: `2px solid ${accent}`,
        borderRadius: "0 6px 6px 0",
        padding: 16,
        willChange: "transform, opacity",
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 9, color: accent, marginBottom: 12 }}>
        // decision
      </div>
      <PostLine at={0.24} progress={progress} width="100%" />
      <PostLine at={0.34} progress={progress} width="100%" />
      <PostLine at={0.44} progress={progress} width="60%" />
    </motion.div>
  );
}
function PostLine({
  at,
  progress,
  width,
}: {
  at: number;
  progress: MotionValue<number>;
  width: string;
}) {
  const w = useTransform(progress, [at, at + 0.12], ["0%", width]);
  return (
    <motion.div
      style={{
        width: w,
        height: 7,
        borderRadius: 3,
        background: hexToRgba(C.textSecondary, 0.5),
        marginBottom: 9,
      }}
    />
  );
}

function CheckinMotif({ progress }: { progress: MotionValue<number>; accent: string }) {
  const cols = [
    { c: C.green, at: 0.2, h: 70 },
    { c: C.amber, at: 0.32, h: 100 },
    { c: C.red, at: 0.44, h: 54 },
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 120 }}>
      {cols.map((col, i) => (
        <CheckinBar key={i} col={col} progress={progress} />
      ))}
    </div>
  );
}
function CheckinBar({
  col,
  progress,
}: {
  col: { c: string; at: number; h: number };
  progress: MotionValue<number>;
}) {
  const h = useTransform(progress, [col.at, col.at + 0.16], [0, col.h]);
  return (
    <motion.div
      style={{
        width: 26,
        height: h,
        borderRadius: "4px 4px 0 0",
        background: `linear-gradient(to top, ${col.c}, ${hexToRgba(col.c, 0.3)})`,
        willChange: "height",
      }}
    />
  );
}

const RUNGS = ["1 →", "3 →", "5 →", "10 →"];
function ReferralMotif({ progress, accent }: { progress: MotionValue<number>; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 180 }}>
      {RUNGS.map((r, i) => {
        const at = 0.2 + i * 0.08;
        return <Rung key={r} label={r} at={at} progress={progress} accent={accent} />;
      })}
    </div>
  );
}
function Rung({
  label,
  at,
  progress,
  accent,
}: {
  label: string;
  at: number;
  progress: MotionValue<number>;
  accent: string;
}) {
  const x = useTransform(progress, [at, at + 0.12], [-30, 0]);
  const opacity = useTransform(progress, [at, at + 0.1], [0, 1]);
  const glowAlpha = useTransform(progress, [at + 0.05, at + 0.18], [0, 0.12]);
  const bg = useMotionTemplate`rgba(245,158,11,${glowAlpha})`;
  return (
    <motion.div
      style={{
        x,
        opacity,
        background: bg,
        border: `1px solid ${hexToRgba(accent, 0.3)}`,
        borderRadius: 4,
        padding: "8px 12px",
        display: "flex",
        gap: 10,
        alignItems: "center",
        willChange: "transform, opacity",
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 10, color: accent }}>{label}</span>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: hexToRgba(accent, 0.18) }} />
    </motion.div>
  );
}

function Motif({
  kind,
  progress,
  accent,
}: {
  kind: MotifKind;
  progress: MotionValue<number>;
  accent: string;
}) {
  switch (kind) {
    case "profile":
      return <ProfileMotif progress={progress} accent={accent} />;
    case "skills":
      return <SkillsMotif progress={progress} accent={accent} />;
    case "cohort":
      return <CohortMotif progress={progress} accent={accent} />;
    case "post":
      return <PostMotif progress={progress} accent={accent} />;
    case "checkin":
      return <CheckinMotif progress={progress} accent={accent} />;
    case "referral":
      return <ReferralMotif progress={progress} accent={accent} />;
  }
}

// ─── The intro slide ─────────────────────────────────────────────────────────
// A standalone pinned scene that introduces the step that follows it: a kinetic
// title, the bespoke motif, an explainer line — then the whole thing warps
// through as you scroll into the action. Not labelled, so it reads as a
// cinematic title card between the counted chapters.
export function ChapterIntro({
  id,
  index,
  title,
  blurb,
  accent = C.amber,
  motif,
}: {
  id: string;
  index: string;
  title: string;
  blurb: string;
  accent?: string;
  motif: MotifKind;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);

  const eyebrowOpacity = useTransform(scrollYProgress, [0.05, 0.14], [0, 1]);
  const blurbY = useTransform(scrollYProgress, [0.5, 0.66], ["110%", "0%"]);
  const blurbOpacity = useTransform(scrollYProgress, [0.5, 0.64], [0, 1]);

  // Accent glow that pulses in behind the title (opacity only).
  const glowOpacity = useTransform(scrollYProgress, [0.1, 0.4, 0.78, 1], [0, 0.5, 0.5, 0]);

  // Warp-through on exit.
  const exitScale = useTransform(scrollYProgress, [0.8, 1], [1, 1.18]);
  const exitOpacity = useTransform(scrollYProgress, [0.82, 1], [1, 0]);
  const exitBlur = useTransform(scrollYProgress, [0.8, 1], [0, 12]);
  const exitFilter = useMotionTemplate`blur(${exitBlur}px)`;

  return (
    <Chapter ref={ref} id={id} heightVh={210}>
      <StickyStage>
        <GhostNumber value={index} progress={scrollYProgress} align="right" />

        {/* Accent glow */}
        <motion.div
          aria-hidden
          style={{
            position: "absolute",
            width: "44vw",
            height: "44vw",
            maxWidth: 520,
            maxHeight: 520,
            opacity: glowOpacity,
            background: `radial-gradient(closest-side, ${hexToRgba(accent, 0.5)} 0%, transparent 70%)`,
            filter: "blur(70px)",
            willChange: "opacity",
          }}
        />

        <motion.div
          style={{
            scale: exitScale,
            opacity: exitOpacity,
            filter: exitFilter,
            transformPerspective: 1200,
            position: "relative",
            width: "100%",
            maxWidth: 640,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            willChange: "transform, opacity, filter",
          }}
        >
          <motion.div
            style={{
              opacity: eyebrowOpacity,
              fontFamily: MONO,
              fontSize: 11,
              color: accent,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              marginBottom: 22,
            }}
          >
            step {index}
          </motion.div>

          <h2
            style={{
              fontFamily: SANS,
              fontSize: "clamp(34px, 6.5vw, 64px)",
              fontWeight: 700,
              color: C.textPrimary,
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
              margin: "0 0 36px",
            }}
          >
            <KineticHeading text={title} progress={scrollYProgress} range={[0.1, 0.5]} />
          </h2>

          <div
            style={{
              minHeight: 130,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 28,
            }}
          >
            <Motif kind={motif} progress={scrollYProgress} accent={accent} />
          </div>

          <div style={{ overflow: "hidden" }}>
            <motion.p
              style={{
                y: blurbY,
                opacity: blurbOpacity,
                fontFamily: SANS,
                fontSize: "clamp(15px, 2.2vw, 19px)",
                fontWeight: 400,
                color: C.textSecondary,
                lineHeight: 1.55,
                maxWidth: 520,
                margin: 0,
                willChange: "transform",
              }}
            >
              {blurb}
            </motion.p>
          </div>
        </motion.div>
      </StickyStage>
    </Chapter>
  );
}
