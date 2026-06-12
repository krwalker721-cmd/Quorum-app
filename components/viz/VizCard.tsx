"use client";

import { useState } from "react";

/**
 * Shared shell for the home-page data visualizations. Header carries the
 * uppercase mono label plus an optional live reading (`meta`); the expand
 * control stretches the card across the grid for a closer look.
 */
export default function VizCard({
  label,
  meta,
  children,
}: {
  label: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="border flex flex-col"
      style={{
        background: "var(--card-elev)",
        borderColor: "var(--border)",
        borderRadius: "var(--radius-card)",
        padding: "16px 18px",
        boxShadow: "var(--shadow-card)",
        gridColumn: expanded ? "1 / -1" : "auto",
        transition: "grid-column 200ms ease",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <p
          className="font-mono lowercase"
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.12em",
            color: "var(--text-muted)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </p>
        {meta && (
          <span className="font-mono lowercase" style={{ fontSize: 10, color: "var(--text-faint)" }}>
            {meta}
          </span>
        )}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="font-mono lowercase ml-auto transition-colors"
          style={{ fontSize: 10, color: "var(--text-faint)", padding: "2px 6px", borderRadius: 6 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f59e0b")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-faint)")}
        >
          {expanded ? "collapse ↙" : "expand ↗"}
        </button>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
