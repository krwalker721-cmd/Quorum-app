import { STAGE_COLOR, initials } from "@/lib/stage";

type Node = { id: string; full_name: string | null; stage: string | null };

/**
 * Small founder-graph constellation: you centered (amber ring), cohort members
 * around you on stage-colored rings, hairline connecting lines, one green
 * "active now" dot. Matches the YOUR COHORT tile in the home mockup.
 */
export default function NetworkGraph({
  you,
  members,
  activeIndex = 0,
}: {
  you: { full_name: string | null };
  members: Node[];
  /** Which surrounding node gets the green active dot (−1 = none). */
  activeIndex?: number;
}) {
  const shown = members.slice(0, 5);
  const cx = 120;
  const cy = 38;
  const rx = 72;
  const ry = 26;

  // Fixed pleasant slots around the center (matches mockup spacing feel).
  const slots = [
    { x: cx - rx, y: cy - ry },
    { x: cx + rx + 3, y: cy - ry + 2 },
    { x: cx - rx + 6, y: cy + ry + 2 },
    { x: cx + rx - 5, y: cy + ry },
    { x: cx, y: cy - ry - 8 },
  ];

  return (
    <svg viewBox="0 0 240 84" style={{ width: "100%", height: "auto", display: "block" }}>
      {shown.map((m, i) => {
        const s = slots[i];
        return (
          <line
            key={`l-${m.id}`}
            x1={cx}
            y1={cy}
            x2={s.x}
            y2={s.y}
            stroke="var(--border-default)"
            strokeWidth={1}
          />
        );
      })}
      {shown.map((m, i) => {
        const s = slots[i];
        const ring = (m.stage && STAGE_COLOR[m.stage]) || "var(--text-muted)";
        return (
          <g key={m.id}>
            <circle cx={s.x} cy={s.y} r={10} fill="var(--bg-elevated)" stroke={ring} strokeWidth={1.3} />
            <text
              x={s.x}
              y={s.y + 3}
              textAnchor="middle"
              fill="var(--text-secondary)"
              style={{ fontSize: 8, fontFamily: "var(--font-mono)" }}
            >
              {initials(m.full_name)}
            </text>
            {i === activeIndex && (
              <circle
                cx={s.x + 8}
                cy={s.y - 8}
                r={3}
                fill="var(--green)"
                stroke="var(--bg-surface)"
                strokeWidth={1.3}
              />
            )}
          </g>
        );
      })}
      {/* You */}
      <circle cx={cx} cy={cy} r={14} fill="var(--bg-elevated)" stroke="var(--text-primary)" strokeWidth={1.3} />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fill="var(--text-primary)"
        style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
      >
        {initials(you.full_name)}
      </text>
    </svg>
  );
}
