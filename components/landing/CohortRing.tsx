import s from "./landing.module.css";

// The hero visual: a cohort of twelve as a slowly turning ring. Twelve points,
// one per seat, woven together, with light flowing along the links and a
// centre for the room itself. Deliberately abstract: no names, faces, or
// results, since there are no members yet to show. Pure SVG and CSS, so it
// needs no JavaScript and stops under prefers-reduced-motion.

const SEATS = 12;
const CENTER = 200;
const RADIUS = 150;

const nodes = Array.from({ length: SEATS }, (_, i) => {
  const angle = (i / SEATS) * Math.PI * 2 - Math.PI / 2;
  return { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
});

// Each seat links to the seats three and five places on: a woven pattern
// rather than a plain ring, so it reads as a room where everyone connects.
const links = nodes.flatMap((a, i) =>
  [3, 5].map((step) => ({ a, b: nodes[(i + step) % SEATS], key: `${i}-${step}` })),
);

export default function CohortRing() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="w-full max-w-[420px] h-auto"
      role="img"
      aria-label="A cohort of twelve founders, all connected"
    >
      <defs>
        <radialGradient id="cohort-glow">
          <stop offset="0%" stopColor="rgba(245,158,11,0.22)" />
          <stop offset="100%" stopColor="rgba(245,158,11,0)" />
        </radialGradient>
      </defs>
      <circle cx={CENTER} cy={CENTER} r={195} fill="url(#cohort-glow)" />

      <g className={s.ringSpin}>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
        />
        {links.map(({ a, b, key }) => (
          <line
            key={key}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className={s.link}
            stroke="rgba(245,158,11,0.28)"
            strokeWidth={1}
          />
        ))}
        {nodes.map((n, i) => (
          <line
            key={`spoke-${i}`}
            x1={CENTER}
            y1={CENTER}
            x2={n.x}
            y2={n.y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        ))}
        {nodes.map((n, i) => (
          <g key={`seat-${i}`}>
            <circle cx={n.x} cy={n.y} r={11} fill="rgba(245,158,11,0.08)" />
            <circle
              cx={n.x}
              cy={n.y}
              r={5}
              fill="#f59e0b"
              className={s.node}
              style={{ animationDelay: `${(i * 0.3).toFixed(1)}s` }}
            />
          </g>
        ))}
      </g>

      <circle cx={CENTER} cy={CENTER} r={22} fill="rgba(248,197,106,0.08)" />
      <circle cx={CENTER} cy={CENTER} r={8} fill="#f8c56a" className={s.node} />
    </svg>
  );
}
