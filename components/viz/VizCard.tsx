"use client";

import { useState } from "react";

export default function VizCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="p-4 border flex flex-col"
      style={{
        background: "var(--card-elev)",
        borderColor: "var(--border)",
        gridColumn: expanded ? "1 / -1" : "auto",
        transition: "grid-column 200ms ease",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider">{label}</p>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="font-mono lowercase text-[0.6rem] text-text-faint hover:text-amber"
        >
          {expanded ? "collapse" : "expand"}
        </button>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
