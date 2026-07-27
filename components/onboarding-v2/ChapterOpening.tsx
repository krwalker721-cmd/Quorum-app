"use client";

import { useRef } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { C, MONO, SANS, hexToRgba } from "./theme";

const WORD = "QUORUM";

// Each letter settles in with a short rise and a light stagger. Deliberately
// restrained — no rotation, no blur, no oversized slam. The mark should read as
// a product wordmark, not a title card.
function Letter({
  char,
  progress,
  i,
  count,
}: {
  char: string;
  progress: MotionValue<number>;
  i: number;
  count: number;
}) {
  const t0 = 0.06 + (i / count) * 0.18;
  const t1 = t0 + 0.12;
  const y = useTransform(progress, [t0, t1], [18, 0]);
  const opacity = useTransform(progress, [t0, t1], [0, 1]);
  return (
    <motion.span
      style={{ display: "inline-block", y, opacity, willChange: "transform, opacity" }}
    >
      {char}
    </motion.span>
  );
}

// Chapter 0 — the cold open. Kept short and matter-of-fact: the mark settles, a
// one-line positioning statement lands, and the whole thing lifts away. No
// loader, no camera fly-through — this is a sign on a door, not an overture.
export function ChapterOpening() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);
  const letters = WORD.split("");

  const eyebrowOpacity = useTransform(scrollYProgress, [0.02, 0.1, 0.62, 0.74], [0, 1, 1, 0]);

  // Tagline arrives just after the mark has settled.
  const taglineOpacity = useTransform(scrollYProgress, [0.3, 0.42, 0.66, 0.78], [0, 1, 1, 0]);
  const taglineY = useTransform(scrollYProgress, [0.3, 0.42], [14, 0]);

  // Exit — a short lift and fade, not a push-through.
  const markOpacity = useTransform(scrollYProgress, [0.62, 0.86], [1, 0]);
  const markY = useTransform(scrollYProgress, [0.62, 0.86], [0, -40]);

  // Underline rule draws under the mark as it settles.
  const ruleWidth = useTransform(scrollYProgress, [0.26, 0.42], ["0%", "100%"]);

  // Scroll cue, only at the very start.
  const cueOpacity = useTransform(scrollYProgress, [0, 0.06, 0.16], [1, 1, 0]);

  return (
    <Chapter ref={ref} id="chapter-0" heightVh={170}>
      <StickyStage>
        <motion.div
          style={{
            opacity: markOpacity,
            y: markY,
            textAlign: "center",
            willChange: "transform, opacity",
          }}
        >
          <motion.div
            style={{
              opacity: eyebrowOpacity,
              fontFamily: MONO,
              fontSize: 10,
              color: C.textMuted,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            welcome
          </motion.div>

          <div
            style={{
              fontFamily: SANS,
              fontSize: "clamp(34px, 7vw, 76px)",
              fontWeight: 600,
              letterSpacing: "0.01em",
              color: C.textPrimary,
              lineHeight: 1,
              display: "flex",
              justifyContent: "center",
              flexWrap: "nowrap",
            }}
          >
            {letters.map((ch, i) => (
              <Letter key={i} char={ch} progress={scrollYProgress} i={i} count={letters.length} />
            ))}
          </div>

          <motion.div
            style={{
              width: ruleWidth,
              height: 1,
              maxWidth: 260,
              margin: "16px auto 0",
              background: `linear-gradient(90deg, transparent, ${hexToRgba(C.amber, 0.55)}, transparent)`,
            }}
          />

          <div style={{ overflow: "hidden", marginTop: 20 }}>
            <motion.p
              style={{
                y: taglineY,
                opacity: taglineOpacity,
                fontFamily: SANS,
                fontSize: "clamp(14px, 1.8vw, 17px)",
                fontWeight: 400,
                color: C.textSecondary,
                textAlign: "center",
                maxWidth: 460,
                margin: "0 auto",
                lineHeight: 1.5,
                willChange: "transform",
              }}
            >
              A room of founders who&rsquo;ve already been where you&rsquo;re going.
            </motion.p>
          </div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          style={{
            opacity: cueOpacity,
            position: "absolute",
            bottom: "6%",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 10,
            color: C.textDisabled,
            letterSpacing: "0.16em",
          }}
        >
          scroll ↓
        </motion.div>
      </StickyStage>
    </Chapter>
  );
}
