import s from "./landing.module.css";

// The Buildathon's visual, beside the cohort ring and the collab weave: the
// arena during a live Buildathon. Teams sit around the stadium as pods (their
// founders as dots), the clock counts down in the middle, some teams pulse
// with activity and a few have already submitted. Like the other two it's
// abstract on purpose: no real teams or projects, so nothing invented reads
// as proof. Every team's work is sealed until the reveal, which is why the
// pods show who and how busy, never what.
//
// Pure SVG and CSS, no JavaScript; motion stops under prefers-reduced-motion.

const CX = 200;
const CY = 168;
const RX = 162;
const RY = 112;

// Eight teams around the stadium: colour, founders on the team, and whether
// the team has submitted or is mid-burst.
const TEAMS = [
  { color: "#a78bfa", people: 3, state: "submitted" },
  { color: "#38bdf8", people: 4, state: "busy" },
  { color: "#f59e0b", people: 2, state: "busy" },
  { color: "#22c55e", people: 3, state: "quiet" },
  { color: "#f472b6", people: 4, state: "submitted" },
  { color: "#2dd4bf", people: 3, state: "busy" },
  { color: "#fb923c", people: 2, state: "quiet" },
  { color: "#facc15", people: 3, state: "busy" },
] as const;

const pods = TEAMS.map((t, i) => {
  const a = (-90 + (360 / TEAMS.length) * i) * (Math.PI / 180);
  return { ...t, key: i, x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) };
});

const POD_W = 50;
const POD_H = 30;

export default function BuildathonArena() {
  return (
    <svg
      viewBox="0 0 400 336"
      className="w-full max-w-[460px] h-auto"
      role="img"
      aria-label="The arena during a live Buildathon: eight teams around a countdown clock, some working, some already submitted"
    >
      <defs>
        <radialGradient id="arena-glow">
          <stop offset="0%" stopColor="rgba(245,158,11,0.18)" />
          <stop offset="100%" stopColor="rgba(245,158,11,0)" />
        </radialGradient>
      </defs>
      <ellipse cx={CX} cy={CY} rx={196} ry={150} fill="url(#arena-glow)" />

      {/* The stands: two rings of the stadium. */}
      <ellipse cx={CX} cy={CY} rx={RX + 30} ry={RY + 26} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="rgba(245,158,11,0.22)" strokeWidth={1} className={s.link} />
      <ellipse cx={CX} cy={CY} rx={RX - 46} ry={RY - 38} fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />

      {/* The clock in the middle of the floor. */}
      <g>
        <rect x={CX - 66} y={CY - 32} width={132} height={64} rx={14} fill="rgba(11,14,19,0.92)" stroke="rgba(245,158,11,0.45)" strokeWidth={1} />
        <circle cx={CX - 40} cy={CY - 14} r={3} fill="#ef4444" className={s.node} />
        <text x={CX - 32} y={CY - 10.5} fill="#fca5a5" fontSize={9.5} fontFamily="ui-monospace, monospace" letterSpacing="1.5">
          LIVE
        </text>
        <text x={CX} y={CY + 16} fill="#f8c56a" fontSize={21} fontWeight={600} textAnchor="middle" fontFamily="ui-monospace, monospace">
          31:42:08
        </text>
      </g>

      {/* The teams. */}
      {pods.map((p) => {
        const left = p.x - POD_W / 2;
        const top = p.y - POD_H / 2;
        const gap = POD_W / (p.people + 1);
        return (
          <g key={p.key}>
            {p.state === "busy" && (
              <rect
                x={left - 5}
                y={top - 5}
                width={POD_W + 10}
                height={POD_H + 10}
                rx={11}
                fill="none"
                stroke={p.color}
                strokeOpacity={0.5}
                strokeWidth={1}
                className={s.node}
                style={{ animationDelay: `${(p.key * 0.45).toFixed(2)}s` }}
              />
            )}
            <rect
              x={left}
              y={top}
              width={POD_W}
              height={POD_H}
              rx={8}
              fill={`${p.color}1f`}
              stroke={`${p.color}80`}
              strokeWidth={1}
            />
            {Array.from({ length: p.people }, (_, j) => (
              <circle key={j} cx={left + gap * (j + 1)} cy={p.y} r={4.2} fill={p.color} opacity={p.state === "quiet" ? 0.5 : 0.95} />
            ))}
            {p.state === "submitted" && (
              <g>
                <circle cx={left + POD_W - 2} cy={top + 2} r={7.5} fill="#0b0e13" stroke="#22c55e" strokeWidth={1.2} />
                <path
                  d={`M ${left + POD_W - 5.5} ${top + 2.2} l 2.4 2.4 l 4.4 -4.6`}
                  fill="none"
                  stroke="#4ade80"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            )}
          </g>
        );
      })}

      {/* The floor's caption. */}
      <text x={CX} y={326} fill="rgba(255,255,255,0.32)" fontSize={10} textAnchor="middle" fontFamily="ui-monospace, monospace">
        2 of 8 submitted · every project sealed until the reveal
      </text>
    </svg>
  );
}
