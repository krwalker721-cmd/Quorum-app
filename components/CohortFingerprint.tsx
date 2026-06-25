import type { Fingerprint } from "@/lib/recognition";

// Axis order around the pentagon. Each axis is one post kind; the shape is the
// proportion of the user's posts in that kind.
const TYPES: { key: Exclude<keyof Fingerprint, "total">; color: string }[] = [
  { key: "decision", color: "#f59e0b" },
  { key: "win", color: "#22c55e" },
  { key: "blocker", color: "#f85149" },
  { key: "question", color: "#58a6ff" },
  { key: "update", color: "#8b949e" },
];

/**
 * A pentagon radar chart. Each axis represents a post kind; the plotted shape is
 * drawn from the proportion of each kind in the user's posting history.
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

  const center = size / 2;
  const maxRadius = size * 0.42;
  const n = TYPES.length;

  const points = TYPES.map((t, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const ratio = (fp[t.key] as number) / fp.total;
    // minimum 2px so the shape is always visible even for a single axis
    const radius = Math.max(ratio * maxRadius, 2);
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      color: t.color,
    };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {/* concentric pentagon guides */}
      {[0.25, 0.5, 0.75, 1].map((scale) => {
        const guide = TYPES.map((_, i) => {
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
          return `${(center + maxRadius * scale * Math.cos(angle)).toFixed(1)},${(
            center + maxRadius * scale * Math.sin(angle)
          ).toFixed(1)}`;
        });
        return <polygon key={scale} points={guide.join(" ")} fill="none" stroke="#21262d" strokeWidth={1} />;
      })}

      {/* axis spokes */}
      {TYPES.map((_, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + maxRadius * Math.cos(angle)}
            y2={center + maxRadius * Math.sin(angle)}
            stroke="#21262d"
            strokeWidth={1}
          />
        );
      })}

      {/* the fingerprint shape */}
      <path d={pathD} fill="rgba(245,158,11,0.08)" stroke="#f59e0b" strokeWidth={1.5} strokeLinejoin="round" />

      {/* data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={p.color} />
      ))}
    </svg>
  );
}
