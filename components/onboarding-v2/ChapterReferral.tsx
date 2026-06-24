"use client";

import { useRef, type ReactNode } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { C, MONO, SANS, hexToRgba } from "./theme";

const MILESTONES = [
  { count: "1 →", reward: "$10 off next month" },
  { count: "3 →", reward: "1 free month" },
  { count: "5 →", reward: "2 free months" },
  { count: "10 →", reward: "50% off 6 months" },
  { count: "25 →", reward: "free for a year" },
];

function RewardLadder({ lit }: { lit: boolean }) {
  return (
    <div style={{ width: 240, margin: "24px auto 0" }}>
      {MILESTONES.map((m) => (
        <div
          key={m.count}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              padding: "3px 8px",
              borderRadius: 3,
              flexShrink: 0,
              background: lit ? hexToRgba(C.amber, 0.1) : C.surface,
              border: `1px solid ${lit ? hexToRgba(C.amber, 0.25) : C.border}`,
              color: lit ? C.amber : C.textDisabled,
              transition: "all 250ms ease",
            }}
          >
            {m.count}
          </span>
          <span
            style={{
              fontFamily: SANS,
              fontSize: 12,
              color: lit ? C.textPrimary : C.textMuted,
              transition: "color 250ms ease",
            }}
          >
            {m.reward}
          </span>
        </div>
      ))}
    </div>
  );
}

function Beat({
  opacity,
  y,
  children,
}: {
  opacity: MotionValue<number>;
  y: MotionValue<number>;
  children: ReactNode;
}) {
  return (
    <motion.div
      style={{
        opacity,
        y,
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 20px",
        textAlign: "center",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </motion.div>
  );
}

// Chapter 14 — the referral sell, three cinematic beats. Beat 1 introduces the
// ladder (unlit); beat 2 lights it up with the monthly bonus; beat 3 teases the
// gated referral link.
export function ChapterReferral() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);

  const b1Opacity = useTransform(scrollYProgress, [0.02, 0.18, 0.28, 0.34], [0, 1, 1, 0]);
  const b1Y = useTransform(scrollYProgress, [0.02, 0.18], [30, 0]);
  const b2Opacity = useTransform(scrollYProgress, [0.36, 0.5, 0.6, 0.66], [0, 1, 1, 0]);
  const b2Y = useTransform(scrollYProgress, [0.36, 0.5], [30, 0]);
  const b3Opacity = useTransform(scrollYProgress, [0.68, 0.82], [0, 1]);
  const b3Y = useTransform(scrollYProgress, [0.68, 0.82], [30, 0]);

  return (
    <Chapter ref={ref} id="chapter-14" heightVh={400}>
      <StickyStage>
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <Beat opacity={b1Opacity} y={b1Y}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: C.amber,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 16,
              }}
            >
              // one more thing
            </div>
            <p
              style={{
                fontFamily: SANS,
                fontSize: "clamp(20px, 3.5vw, 24px)",
                color: C.textPrimary,
                maxWidth: 480,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Refer a founder. Get rewarded. Make Quorum more accessible.
            </p>
            <RewardLadder lit={false} />
          </Beat>

          <Beat opacity={b2Opacity} y={b2Y}>
            <p
              style={{
                fontFamily: SANS,
                fontSize: "clamp(18px, 3vw, 22px)",
                color: C.textPrimary,
                maxWidth: 480,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              The more founders you bring, the less you pay.
            </p>
            <RewardLadder lit />
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: "10px 14px",
                maxWidth: 260,
                margin: "16px auto 0",
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 8, color: C.textDisabled, marginBottom: 4 }}>
                // monthly bonus
              </div>
              <div style={{ fontFamily: SANS, fontSize: 11, color: C.textSecondary }}>
                5+ active referrals → $30 off every month
              </div>
            </div>
          </Beat>

          <Beat opacity={b3Opacity} y={b3Y}>
            <p
              style={{
                fontFamily: SANS,
                fontSize: "clamp(16px, 2.6vw, 20px)",
                color: C.textSecondary,
                maxWidth: 480,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Your referral link unlocks once you&rsquo;ve settled in.
            </p>
            <div
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: "10px 16px",
                fontFamily: MONO,
                fontSize: 12,
                color: C.textDisabled,
                maxWidth: 300,
                margin: "20px auto 12px",
              }}
            >
              quorum.app/signup?ref=••••••
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.textDisabled }}>
              // complete your profile to activate
            </div>
          </Beat>
        </div>
      </StickyStage>
    </Chapter>
  );
}
