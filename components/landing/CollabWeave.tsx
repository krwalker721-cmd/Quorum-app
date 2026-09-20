import s from "./landing.module.css";

// The collab board's visual, the counterpart to CohortRing: three projects
// (squares) with the founders building them (dots) around each, and founders
// who sit between two projects on the links. Where the cohort ring turns —
// one room, always the same people — this one flows: work moving between
// founders. Abstract for the same reason the ring is: there are no real
// projects to show yet, and invented ones would be invented proof.
//
// Pure SVG and CSS, no JavaScript, and every animation stops under
// prefers-reduced-motion (landing.module.css).

const HUB_R = 16;
const SPOKE_R = 62;

// Three projects in a triangle, each with the builders fanned out away from
// the centre so the links between projects stay readable.
const HUBS = [
  { x: 200, y: 98, spokes: [200, 250, 290, 340] },
  { x: 94, y: 286, spokes: [130, 180, 230] },
  { x: 306, y: 286, spokes: [50, 0, -50] },
];

const point = (cx: number, cy: number, deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const builders = HUBS.flatMap((h, hi) =>
  h.spokes.map((deg, si) => ({ hub: h, key: `${hi}-${si}`, ...point(h.x, h.y, deg, SPOKE_R) })),
);

// The link between each pair of projects, with a founder working across both
// sitting on it.
const bridges = [
  [HUBS[0], HUBS[1]],
  [HUBS[1], HUBS[2]],
  [HUBS[2], HUBS[0]],
].map(([a, b], i) => ({
  key: `bridge-${i}`,
  a,
  b,
  mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
}));

export default function CollabWeave() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="w-full max-w-[420px] h-auto"
      role="img"
      aria-label="Three founder projects, each with the people building them, linked across the network"
    >
      <defs>
        <radialGradient id="collab-glow">
          <stop offset="0%" stopColor="rgba(245,158,11,0.2)" />
          <stop offset="100%" stopColor="rgba(245,158,11,0)" />
        </radialGradient>
      </defs>
      <circle cx={200} cy={212} r={195} fill="url(#collab-glow)" />

      {/* Project to project: the links light travels along. */}
      {bridges.map(({ key, a, b }) => (
        <line
          key={key}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          className={s.link}
          stroke="rgba(245,158,11,0.3)"
          strokeWidth={1}
        />
      ))}

      {/* Each project and the founders on it. */}
      {builders.map(({ hub, key, x, y }) => (
        <line key={`spoke-${key}`} x1={hub.x} y1={hub.y} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
      ))}
      {builders.map(({ key, x, y }, i) => (
        <g key={`builder-${key}`}>
          <circle cx={x} cy={y} r={10} fill="rgba(245,158,11,0.07)" />
          <circle
            cx={x}
            cy={y}
            r={4.5}
            fill="#f59e0b"
            className={s.node}
            style={{ animationDelay: `${(i * 0.28).toFixed(2)}s` }}
          />
        </g>
      ))}

      {/* Founders building on more than one thing. */}
      {bridges.map(({ key, mid }, i) => (
        <g key={`shared-${key}`}>
          <circle cx={mid.x} cy={mid.y} r={11} fill="rgba(248,197,106,0.07)" />
          <circle
            cx={mid.x}
            cy={mid.y}
            r={5}
            fill="#f8c56a"
            className={s.node}
            style={{ animationDelay: `${(i * 0.6 + 0.4).toFixed(2)}s` }}
          />
        </g>
      ))}

      {/* The projects themselves: squares, so a thing being built reads
          differently from the people building it. */}
      {HUBS.map((h, i) => (
        <g key={`hub-${i}`}>
          <circle cx={h.x} cy={h.y} r={28} fill="rgba(245,158,11,0.09)" />
          <rect
            x={h.x - HUB_R}
            y={h.y - HUB_R}
            width={HUB_R * 2}
            height={HUB_R * 2}
            rx={6}
            fill="rgba(245,158,11,0.16)"
            stroke="rgba(245,158,11,0.55)"
            strokeWidth={1}
          />
          <rect
            x={h.x - 5}
            y={h.y - 5}
            width={10}
            height={10}
            rx={2.5}
            fill="#f8c56a"
            className={s.node}
            style={{ animationDelay: `${(i * 0.9).toFixed(2)}s` }}
          />
        </g>
      ))}
    </svg>
  );
}
