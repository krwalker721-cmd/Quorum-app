import CohortFillStat from "@/components/CohortFillStat";

function SegmentedBar({ filled, total = 12 }: { filled: number; total?: number }) {
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`seg${i < filled ? " on" : ""}`} />
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
    <div className="stat-item">
      <span className="stat-label font-mono lowercase">{label}</span>
      <span className="stat-value font-mono">{value}</span>
      {bar && <SegmentedBar filled={bar.filled} total={bar.total} />}
    </div>
  );
}

export default function StatStrip({
  members,
  activeNow,
  posts7d,
  cohortFill,
  cohortMax,
  cohortIds,
  trustScore,
}: {
  members: number;
  activeNow: number;
  posts7d: number;
  cohortFill: number;
  cohortMax: number;
  cohortIds: string[];
  trustScore: number;
}) {
  return (
    <div className="stat-strip overflow-x-auto scroll-thin">
      <Stat label="members" value={members} />
      <Stat label="active_now" value={activeNow} />
      <Stat label="posts_7d" value={posts7d} />
      <CohortFillStat cohortIds={cohortIds} initialFill={cohortFill} cohortMax={cohortMax} />
      <Stat
        label="trust_score"
        value={trustScore}
        bar={{ filled: Math.max(0, Math.min(12, Math.round(trustScore / 10))), total: 12 }}
      />
    </div>
  );
}
