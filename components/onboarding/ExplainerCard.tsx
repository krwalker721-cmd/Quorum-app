"use client";

import { C, MONO, SANS } from "./ui";

// One tappable card in the 4-card explainer pattern (steps 04/06/08/10/12/14).
// Quiet until tapped: the left border lights amber when active, dims to a muted
// grey once seen, and the detail paragraph expands only while active.
export interface ExplainerCardProps {
  label: string;
  text: string;
  detail: string;
  isActive: boolean;
  isSeen: boolean;
  onClick: () => void;
}

export default function ExplainerCard({
  label,
  text,
  detail,
  isActive,
  isSeen,
  onClick,
}: ExplainerCardProps) {
  const borderLeftColor = isActive ? C.amber : isSeen ? C.borderMuted : C.border;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderLeft: `2px solid ${borderLeftColor}`,
        borderRadius: 4,
        padding: "11px 13px",
        cursor: "pointer",
        marginBottom: 8,
        backgroundColor: isActive ? "rgba(245,158,11,0.03)" : C.surface,
        transition: "border-color 200ms ease, background-color 200ms ease",
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 9,
          color: isActive ? C.amber : C.textDisabled,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 8,
          transition: "color 200ms ease",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 13,
          color: isActive ? C.textPrimary : C.textSecondary,
          lineHeight: 1.5,
          transition: "color 200ms ease",
        }}
      >
        {text}
      </div>
      {isActive && (
        <div
          style={{
            fontFamily: SANS,
            fontSize: 12,
            color: C.textMuted,
            lineHeight: 1.6,
            marginTop: 9,
          }}
        >
          {detail}
        </div>
      )}
    </div>
  );
}
