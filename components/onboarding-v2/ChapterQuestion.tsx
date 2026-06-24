"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence, useTransform } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { C, MONO, SANS, hexToRgba } from "./theme";

const QUESTION =
  "Have you ever wanted a room full of founders who have the same mindset as you — and have already solved the problems you're about to face?";

// Chapter 1 — the opening question. Words land one by one when the chapter is
// reached; conversation bubbles fade in on scroll; tapping either replies and
// reveals Quorum's "then keep scrolling" before the scroll cue.
export function ChapterQuestion() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);
  const words = QUESTION.split(" ");

  const [replied, setReplied] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Bubbles fade in across 0.3–0.4 of the chapter's scroll.
  const bubblesOpacity = useTransform(scrollYProgress, [0.3, 0.4], [0, 1]);
  const bubblesY = useTransform(scrollYProgress, [0.3, 0.4], [20, 0]);

  function reply() {
    if (replied) return;
    setReplied(true);
    // The scroll cue follows once Quorum's reply has settled.
    setTimeout(() => setShowHint(true), 1000);
  }

  const userBubble = (text: string, delay: number) => (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={reply}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && reply()}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{
        alignSelf: "flex-end",
        background: hexToRgba(C.amber, 0.08),
        border: `1px solid ${hexToRgba(C.amber, 0.2)}`,
        borderRadius: "12px 4px 4px 12px",
        padding: "12px 20px",
        fontFamily: SANS,
        fontSize: 15,
        color: C.textPrimary,
        cursor: "pointer",
        maxWidth: 320,
      }}
    >
      {text}
    </motion.div>
  );

  return (
    <Chapter ref={ref} id="chapter-1" heightVh={300}>
      <StickyStage>
        <div
          style={{
            width: "100%",
            maxWidth: 640,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          <p
            style={{
              fontFamily: SANS,
              fontSize: "clamp(22px, 4vw, 32px)",
              fontWeight: 500,
              color: C.textPrimary,
              lineHeight: 1.5,
              textAlign: "center",
              margin: 0,
            }}
          >
            {words.map((w, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: "inline-block", marginRight: "0.28em" }}
              >
                {w}
              </motion.span>
            ))}
          </p>

          {/* Conversation */}
          <div
            style={{
              width: "100%",
              maxWidth: 380,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minHeight: 120,
            }}
          >
            <AnimatePresence mode="wait">
              {!replied ? (
                <motion.div
                  key="bubbles"
                  style={{
                    opacity: bubblesOpacity,
                    y: bubblesY,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    willChange: "opacity, transform",
                  }}
                >
                  {userBubble("That's exactly what I've been missing", 0)}
                  {userBubble("Tell me more", 0.3)}
                </motion.div>
              ) : (
                <motion.div
                  key="response"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  style={{
                    alignSelf: "flex-start",
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: "4px 12px 12px 4px",
                    padding: "12px 20px",
                    fontFamily: SANS,
                    fontSize: 15,
                    color: C.textSecondary,
                    maxWidth: 320,
                  }}
                >
                  Then keep scrolling.
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showHint && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, y: [0, 6, 0] }}
                transition={{
                  opacity: { duration: 0.5 },
                  y: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
                }}
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: C.textDisabled,
                  letterSpacing: "0.1em",
                  textAlign: "center",
                }}
              >
                scroll ↓
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </StickyStage>
    </Chapter>
  );
}
