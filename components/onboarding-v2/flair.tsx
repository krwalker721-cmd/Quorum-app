"use client";

// Reusable "flashy" motion primitives — the kinetic vocabulary shared by the
// cold open, the per-step intro slides, and the action cards. Two flavours:
//
//   • scroll-scrubbed (KineticHeading, WarpIn) — driven by a chapter's progress
//     MotionValue, so they assemble/disassemble as you scroll, reversibly.
//   • one-shot (Stagger / StaggerItem) — a cascade that plays once when content
//     enters, for the moment a form's fields fly into place.
//
// Everything here stays on transform + opacity (+ a brief blur on single
// elements) so it composites smoothly.

import { type ReactNode } from "react";
import {
  motion,
  useTransform,
  useMotionTemplate,
  type MotionValue,
  type Variants,
} from "framer-motion";

// One word of a kinetic heading: flies in from an alternating offset with a
// little rotation as `progress` crosses `range`. Transform + opacity only.
function KWord({
  word,
  progress,
  range,
  index,
}: {
  word: string;
  progress: MotionValue<number>;
  range: [number, number];
  index: number;
}) {
  const dir = index % 2 === 0 ? 1 : -1;
  const span = range[1] - range[0];
  const x = useTransform(progress, range, [dir * 70, 0]);
  const y = useTransform(progress, range, [46 + (index % 3) * 14, 0]);
  const rotate = useTransform(progress, range, [dir * 9, 0]);
  const opacity = useTransform(progress, [range[0], range[0] + span * 0.55], [0, 1]);
  return (
    <motion.span
      style={{
        display: "inline-block",
        x,
        y,
        rotate,
        opacity,
        marginRight: "0.28em",
        willChange: "transform, opacity",
      }}
    >
      {word}
    </motion.span>
  );
}

// A heading whose words fly in one after another across `range`.
export function KineticHeading({
  text,
  progress,
  range,
  style,
}: {
  text: string;
  progress: MotionValue<number>;
  range: [number, number];
  style?: React.CSSProperties;
}) {
  const words = text.split(" ");
  const span = range[1] - range[0];
  return (
    <span style={{ display: "inline-block", ...style }}>
      {words.map((w, i) => {
        const t0 = range[0] + (i / words.length) * span * 0.7;
        const t1 = Math.min(range[1], t0 + span * 0.4);
        return (
          <KWord key={i} word={w} progress={progress} range={[t0, t1]} index={i} />
        );
      })}
    </span>
  );
}

// A block that warps in with depth — rises, scales up, un-skews in 3D and
// sharpens from a blur — as `progress` crosses `range`. For cards and panels.
export function WarpIn({
  progress,
  range,
  children,
  style,
  lift = 90,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  children: ReactNode;
  style?: React.CSSProperties;
  lift?: number;
}) {
  const opacity = useTransform(progress, range, [0, 1]);
  const y = useTransform(progress, range, [lift, 0]);
  const scale = useTransform(progress, range, [0.9, 1]);
  const rotateX = useTransform(progress, range, [32, 0]);
  const blurPx = useTransform(progress, range, [9, 0]);
  const filter = useMotionTemplate`blur(${blurPx}px)`;
  return (
    <motion.div
      style={{
        opacity,
        y,
        scale,
        rotateX,
        filter,
        transformPerspective: 1200,
        willChange: "transform, opacity, filter",
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── One-shot cascade (for filled-in content arriving) ───────────────────────
const containerV: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const itemV: Variants = {
  hidden: { opacity: 0, y: 26, rotateX: -22, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

// Wrap a group of fields; its StaggerItem children fly in one after another the
// first time the group scrolls into view.
export function Stagger({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      variants={containerV}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      style={{ transformPerspective: 1000, ...style }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div variants={itemV} style={{ willChange: "transform, opacity", ...style }}>
      {children}
    </motion.div>
  );
}
