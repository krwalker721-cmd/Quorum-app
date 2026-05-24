function SegmentedBar({ filled, total = 12 }: { filled: number; total?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: 6,
            height: 8,
            background: i < filled ? "#dc6414" : "var(--border)",
            opacity: i < filled ? 1 : 0.6,
          }}
        />
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  bar,
}: {
  label: string;
  value: string | number;
  bar?: { filled: number; total?: number };
}) {
  return (
    <div className="flex flex-col gap-1 pr-6 min-w-0">
      <span className="font-mono lowercase text-[0.6rem] tracking-wider text-text-faint">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-text-primary">{value}</span>
        {bar && <SegmentedBar filled={bar.filled} total={bar.total} />}
      </div>
    </div>
  );
}

export default function StatStrip({
  members,
  activeNow,
  posts7d,
  cohortFill,
  cohortMax,
  trustScore,
}: {
  members: number;
  activeNow: number;
  posts7d: number;
  cohortFill: number;
  cohortMax: number;
  trustScore: number;
}) {
  return (
    <div
      className="flex items-center px-6 py-3 border-b overflow-x-auto scroll-thin"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <Stat label="members" value={members} />
      <Stat label="active_now" value={activeNow} />
      <Stat label="posts_7d" value={posts7d} />
      <Stat
        label="cohort_fill"
        value={`${cohortFill}/${cohortMax}`}
        bar={{ filled: Math.min(cohortFill, cohortMax), total: cohortMax }}
      />
      <Stat
        label="trust_score"
        value={trustScore}
        bar={{ filled: Math.max(0, Math.min(12, Math.round(trustScore / 10))), total: 12 }}
      />
    </div>
  );
}
