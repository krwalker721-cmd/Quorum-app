import type { Fingerprint } from "@/lib/recognition";

const SEGMENTS: { key: keyof Fingerprint; color: string }[] = [
  { key: "question", color: "#38bdf8" },
  { key: "update", color: "#707070" },
  { key: "decision", color: "#e8702a" },
  { key: "win", color: "#22c55e" },
  { key: "blocker", color: "#a78bfa" },
];

/**
 * A subtle, abstract radial shape. Each post-type contributes one petal whose
 * length is proportional to its share of the user's cohort posts.
 * Not numbers. Not a chart. A shape that changes over time.
 */
export default function CohortFingerprint({
  fp,
  size = 140,
}: {
  fp: Fingerprint;
  size?: number;
}) {
  if (fp.total === 0) {
    return (
      <p className="font-mono lowercase text-[0.7rem] text-text-faint">
        post in the room and a shape will emerge.
      </p>
    );
  }
  const cx = size / 2;
  const cy = size / 2;
  const baseR = size * 0.16; // inner radius
  const maxR = size * 0.42; // outermost reach
  const n = SEGMENTS.length;
  const points: string[] = [];
  for (let i = 0; i < n; i++) {
    const seg = SEGMENTS[i];
    const share = (fp[seg.key] as number) / fp.total;
    const r = baseR + (maxR - baseR) * share;
    const theta = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const polyPoints = points.join(" ");
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <defs>
        <radialGradient id="fp-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(232, 112, 42,0.18)" />
          <stop offset="100%" stopColor="rgba(232, 112, 42,0.02)" />
        </radialGradient>
      </defs>
      {/* faint outer ring as visual anchor */}
      <circle
        cx={cx}
        cy={cy}
        r={maxR}
        fill="none"
        stroke="rgba(232, 112, 42,0.10)"
        strokeDasharray="2 3"
      />
      <polygon
        points={polyPoints}
        fill="url(#fp-fill)"
        stroke="rgba(232, 112, 42,0.55)"
        strokeWidth={1}
      />
      {SEGMENTS.map((s, i) => {
        const share = (fp[s.key] as number) / fp.total;
        const r = baseR + (maxR - baseR) * share;
        const theta = (i / n) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        return <circle key={s.key} cx={x} cy={y} r={2} fill={s.color} />;
      })}
    </svg>
  );
}
