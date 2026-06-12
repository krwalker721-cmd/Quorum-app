import VizCard from "./VizCard";
import { STAGE_COLOR } from "@/lib/stage";

type Member = { id: string; full_name: string | null; stage: string | null };

/**
 * Radial network map: you at the center, your cohort on the inner orbit,
 * the wider pulse community on the outer orbit. Orbit guides + a legend keep
 * it readable as an actual diagram rather than decorative dots.
 */
export default function CohortNetwork({ members }: { members: Member[] }) {
  const cohort = members.slice(0, 6);
  const pulse = members.slice(6, 12);
  const cx = 100;
  const cy = 78;
  const ringR1 = 42;
  const ringR2 = 66;

  const pos = (i: number, total: number, r: number, phase = 0) => {
    const angle = (i / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2 + phase;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };

  return (
    <VizCard label="cohort_network" meta={`${cohort.length + pulse.length} nodes`}>
      <svg viewBox="0 0 200 160" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="net-center-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Orbit guides */}
        <circle
          cx={cx} cy={cy} r={ringR1}
          fill="none" stroke="#30363d" strokeWidth="0.5"
          strokeDasharray="2 3" opacity="0.7"
        />
        <circle
          cx={cx} cy={cy} r={ringR2}
          fill="none" stroke="#30363d" strokeWidth="0.5"
          strokeDasharray="2 3" opacity="0.45"
        />

        {/* Center glow */}
        <circle cx={cx} cy={cy} r="26" fill="url(#net-center-glow)" />

        {/* Connections — cohort strong, pulse faint */}
        {cohort.map((m, i) => {
          const p = pos(i, cohort.length, ringR1);
          return (
            <line
              key={`c-line-${m.id}`}
              x1={cx} y1={cy} x2={p.x} y2={p.y}
              stroke="#f59e0b" strokeWidth="0.7" opacity="0.45"
            />
          );
        })}
        {pulse.map((m, i) => {
          const p = pos(i, pulse.length, ringR2, Math.PI / 8);
          return (
            <line
              key={`p-line-${m.id}`}
              x1={cx} y1={cy} x2={p.x} y2={p.y}
              stroke="#6e7681" strokeWidth="0.5" opacity="0.25"
            />
          );
        })}

        {/* Nodes */}
        {cohort.map((m, i) => {
          const p = pos(i, cohort.length, ringR1);
          const c = (m.stage && STAGE_COLOR[m.stage]) || "#6e7681";
          return (
            <g key={`c-${m.id}`}>
              <circle cx={p.x} cy={p.y} r="5.5" fill={c} opacity="0.18" />
              <circle cx={p.x} cy={p.y} r="3" fill={c} stroke="#0d1117" strokeWidth="0.8" />
            </g>
          );
        })}
        {pulse.map((m, i) => {
          const p = pos(i, pulse.length, ringR2, Math.PI / 8);
          return (
            <circle
              key={`p-${m.id}`}
              cx={p.x} cy={p.y} r="2"
              fill="#6e7681" opacity="0.65"
              stroke="#0d1117" strokeWidth="0.6"
            />
          );
        })}

        {/* You */}
        <circle cx={cx} cy={cy} r="5" fill="#f59e0b" />
        <circle cx={cx} cy={cy} r="9" fill="none" stroke="#f59e0b" strokeWidth="0.5" opacity="0.4" />
        <text
          x={cx} y={cy + 17}
          textAnchor="middle"
          fill="#8b949e"
          style={{ fontSize: 6.5, fontFamily: "var(--font-jetbrains-mono), monospace", letterSpacing: "0.08em" }}
        >
          you
        </text>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="flex items-center gap-1.5 font-mono lowercase" style={{ fontSize: 9, color: "var(--text-muted)" }}>
          <span style={{ width: 10, height: 2, background: "rgba(245,158,11,0.6)", borderRadius: 1 }} />
          cohort · {cohort.length}
        </span>
        <span className="flex items-center gap-1.5 font-mono lowercase" style={{ fontSize: 9, color: "var(--text-muted)" }}>
          <span style={{ width: 10, height: 2, background: "rgba(110,118,129,0.6)", borderRadius: 1 }} />
          pulse · {pulse.length}
        </span>
      </div>
    </VizCard>
  );
}
