"use client";

import type { OnboardingStepProps } from "./types";
import CinematicShell from "./CinematicShell";
import { useCinematicBeats } from "./useCinematicBeats";
import { C, hexToRgba, MONO, SANS } from "./ui";

const BEATS = 3;

const CAPTIONS = [
  "This isn't LinkedIn. <span>Be real,</span> not polished.",
  "Your problem is not unique. <span>Someone here has been there.</span>",
  "One post can save you <span>weeks of doubt.</span>",
];

// ── Beat 0 — LinkedIn vs Quorum ────────────────────────────────────────────
function MiniPost({
  accent,
  tag,
  tagColor,
  body,
  dim,
  glow,
}: {
  accent: string;
  tag: string;
  tagColor: string;
  body: string;
  dim: boolean;
  glow: boolean;
}) {
  return (
    <div style={{ width: 92 }}>
      <div style={{ fontFamily: MONO, fontSize: 7, color: tagColor, marginBottom: 4, textAlign: "center" }}>{tag}</div>
      <div
        style={{
          background: C.surface,
          borderLeft: `2px solid ${accent}`,
          borderRadius: "0 3px 3px 0",
          padding: "8px 9px",
          opacity: dim ? 0.4 : 1,
          boxShadow: glow ? `0 0 0 1px ${hexToRgba(accent, 0.4)}` : "none",
          transition: "opacity 250ms ease",
        }}
      >
        <div style={{ fontFamily: SANS, fontSize: 9, color: C.textSecondary, lineHeight: 1.45 }}>{body}</div>
      </div>
    </div>
  );
}

function CompareVisual() {
  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "flex-start" }}>
      <MiniPost accent={C.green} tag="LinkedIn" tagColor={C.red} body="Just closed our Series A 🎉" dim glow={false} />
      <MiniPost
        accent={C.amber}
        tag="Quorum"
        tagColor={C.green}
        body="Genuinely don't know if I should raise or stay lean..."
        dim={false}
        glow
      />
    </div>
  );
}

// ── Beat 1 — mini ring, one node lit ───────────────────────────────────────
const RCX = 80;
const RCY = 80;
const RR = 56;
const RING = Array.from({ length: 8 }, (_, i) => {
  const a = ((-90 + i * 45) * Math.PI) / 180;
  return { x: RCX + RR * Math.cos(a), y: RCY + RR * Math.sin(a) };
});
const LIT_NODE = 1;

function MiniRing() {
  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 160 160" style={{ width: 160, display: "block", margin: "0 auto" }} aria-hidden>
        {RING.map((p, i) => {
          const on = i === LIT_NODE;
          return (
            <line
              key={`l${i}`}
              x1={RCX}
              y1={RCY}
              x2={p.x}
              y2={p.y}
              stroke={on ? hexToRgba(C.amber, 0.6) : C.border}
              strokeWidth="1"
              style={on ? { animation: "pulse 1.2s infinite" } : undefined}
            />
          );
        })}
        {RING.map((p, i) => {
          const on = i === LIT_NODE;
          return (
            <circle
              key={`n${i}`}
              cx={p.x}
              cy={p.y}
              r={12}
              fill={on ? hexToRgba(C.amber, 0.1) : C.surface}
              stroke={on ? C.amber : C.borderMuted}
              strokeWidth="1"
            />
          );
        })}
        <circle cx={RCX} cy={RCY} r={16} fill={hexToRgba(C.amber, 0.12)} stroke={C.amber} strokeWidth="1.5" />
        <text x={RCX} y={RCY} textAnchor="middle" dominantBaseline="central" fontFamily={MONO} fontSize="7" fill={C.amber}>
          YOU
        </text>
      </svg>
      <div style={{ fontFamily: MONO, fontSize: 8, color: C.textDisabled, marginTop: 6 }}>they&apos;ve been here</div>
    </div>
  );
}

// ── Beat 2 — post + replies ────────────────────────────────────────────────
const REPLIERS = ["Marcus R.", "Aisha L.", "James P."];

function RepliesVisual() {
  return (
    <div style={{ width: 210, margin: "0 auto", textAlign: "left" }}>
      <div
        style={{
          background: C.surface,
          borderLeft: `2px solid ${C.amber}`,
          borderRadius: "0 4px 4px 0",
          padding: "12px 14px",
          marginBottom: 12,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 8, color: C.amber, marginBottom: 6 }}>// decision</div>
        <div style={{ fontFamily: SANS, fontSize: 11, color: C.textSecondary, lineHeight: 1.45 }}>
          Stuck on pricing for 2 weeks.
        </div>
      </div>

      {REPLIERS.map((name, i) => (
        <div
          key={name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginBottom: 7,
            paddingLeft: 14,
            animation: "cinCaptionIn 500ms ease both",
            animationDelay: `${300 + i * 300}ms`,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, flexShrink: 0 }} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: C.textSecondary }}>{name}</span>
          <span style={{ fontFamily: MONO, fontSize: 8, color: C.textDisabled }}>· 2 min ago</span>
        </div>
      ))}
    </div>
  );
}

function PostVisual({ beat }: { beat: number }) {
  if (beat >= 2) return <RepliesVisual />;
  if (beat === 1) return <MiniRing />;
  return <CompareVisual />;
}

export default function Step10_FirstPostExplainer({
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
      eyebrow="// before your first post"
      beats={BEATS}
      currentBeat={currentBeat}
      isComplete={isComplete}
      caption={currentBeat < 0 ? "" : CAPTIONS[beat]}
      onAdvance={advance}
      ctaLabel="Got it — make my first post →"
      onCta={onNext}
      onStepBack={onBack}
    >
      <PostVisual beat={beat} />
    </CinematicShell>
  );
}
