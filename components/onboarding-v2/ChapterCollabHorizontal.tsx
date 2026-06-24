"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, useTransform, useMotionValueEvent } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { C, MONO, SANS, hexToRgba } from "./theme";

interface PanelDef {
  watermark: string;
  context: string;
  accent: string;
  tag: string;
  title: string;
  desc: string;
  pills: string[];
  cta: string;
}

const PANELS: PanelDef[] = [
  {
    watermark: "PROJECTS",
    context: "// build things together",
    accent: C.blue,
    tag: "// project",
    title: "AI research assistant for founders",
    desc: "Early prototype working. Looking for a technical co-builder to ship v1.",
    pills: ["react", "llms", "python"],
    cta: "join →",
  },
  {
    watermark: "NEEDS",
    context: "// post what you need",
    accent: C.purple,
    tag: "// need",
    title: "Need a brand designer",
    desc: "Launching in 6 weeks. Want someone who's done B2B identity work before.",
    pills: ["branding", "b2b", "6-week sprint"],
    cta: "message founder →",
  },
  {
    watermark: "HIRING",
    context: "// hire from people you trust",
    accent: C.green,
    tag: "// hiring",
    title: "First sales hire — seed stage",
    desc: "Close early deals and build the process from scratch. Equity + base.",
    pills: ["sales", "seed", "full-time"],
    cta: "connect →",
  },
];

function Panel({ p }: { p: PanelDef }) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        padding: "0 20px",
        boxSizing: "border-box",
      }}
    >
      {/* Ghost watermark for depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: SANS,
          fontSize: "clamp(60px, 14vw, 120px)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: C.textPrimary,
          opacity: 0.04,
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        {p.watermark}
      </div>

      <div style={{ position: "relative", width: "100%", maxWidth: 460 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: p.accent,
            letterSpacing: "0.08em",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          {p.context}
        </div>
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderLeft: `2px solid ${p.accent}`,
            borderRadius: "0 4px 4px 0",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 9, color: p.accent, marginBottom: 8 }}>
            {p.tag}
          </div>
          <div
            style={{ fontFamily: SANS, fontSize: 17, color: C.textPrimary, marginBottom: 6 }}
          >
            {p.title}
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 13,
              color: C.textSecondary,
              lineHeight: 1.6,
              marginBottom: 16,
            }}
          >
            {p.desc}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {p.pills.map((pill) => (
              <span
                key={pill}
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  padding: "4px 9px",
                  borderRadius: 3,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  color: C.textMuted,
                }}
              >
                {pill}
              </span>
            ))}
          </div>
          <span style={{ fontFamily: MONO, fontSize: 12, color: p.accent }}>{p.cta}</span>
        </div>
      </div>
    </div>
  );
}

// Chapter 12 — vertical scroll drives a horizontal track of three panels
// (projects → needs → hiring). Panel dots track the active panel; a CTA fades in
// once the third panel lands.
export function ChapterCollabHorizontal({ onComplete }: { onComplete: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);
  const [active, setActive] = useState(0);

  const trackX = useTransform(scrollYProgress, [0.1, 0.9], ["0vw", "-200vw"]);
  const contextOverlayOpacity = useTransform(scrollYProgress, [0.02, 0.1], [0, 1]);
  const ctaOpacity = useTransform(scrollYProgress, [0.9, 0.97], [0, 1]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = v < 0.37 ? 0 : v < 0.63 ? 1 : 2;
    setActive((cur) => (cur === next ? cur : next));
  });

  return (
    <Chapter ref={ref} id="chapter-12" heightVh={350}>
      <StickyStage center={false} style={{ position: "sticky" }}>
        {/* Horizontal track */}
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            width: "300vw",
            x: trackX,
            willChange: "transform",
          }}
        >
          {PANELS.map((p) => (
            <Panel key={p.watermark} p={p} />
          ))}
        </motion.div>

        {/* Heading overlay */}
        <motion.div
          style={{
            opacity: contextOverlayOpacity,
            position: "absolute",
            top: "12%",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 12,
            color: C.amber,
            letterSpacing: "0.08em",
            pointerEvents: "none",
          }}
        >
          // this is where work gets done
        </motion.div>

        {/* Panel dots */}
        <div
          style={{
            position: "absolute",
            bottom: "14%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {PANELS.map((_, i) => (
            <div
              key={i}
              style={{
                width: active === i ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: active === i ? C.amber : C.borderMuted,
                transition: "all 250ms ease",
              }}
            />
          ))}
        </div>

        {/* CTA on the final panel */}
        <motion.div
          style={{
            opacity: ctaOpacity,
            position: "absolute",
            bottom: "8%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <CtaButton onClick={onComplete} />
        </motion.div>
      </StickyStage>
    </Chapter>
  );
}

function CtaButton({ onClick }: { onClick: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: C.amber,
        color: C.bg,
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.06em",
        padding: "12px 26px",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
        boxShadow: `0 0 0 4px ${hexToRgba(C.amber, 0.08)}`,
      }}
    >
      Explore the board →
    </button>
  );
}
