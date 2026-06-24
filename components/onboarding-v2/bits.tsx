"use client";

// Small shared presentational bits used by the cohort reveal and the journey
// summary — a circular monogram avatar and a stage pill.

import { C, MONO, hexToRgba, stageLabel, STAGE_COLORS } from "./theme";

export function Avatar({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        borderRadius: "50%",
        border: `1.5px solid ${color}`,
        background: hexToRgba(color, 0.12),
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: MONO,
        fontSize: 12,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
}

export function StagePill({ stage }: { stage: string | null }) {
  const color = stage ? STAGE_COLORS[stage] ?? C.textMuted : C.textMuted;
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 9,
        padding: "3px 8px",
        borderRadius: 3,
        border: `1px solid ${hexToRgba(color, 0.3)}`,
        background: hexToRgba(color, 0.06),
        color,
        whiteSpace: "nowrap",
      }}
    >
      {stageLabel(stage)}
    </span>
  );
}
