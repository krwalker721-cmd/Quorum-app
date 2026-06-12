import CohortFillStat from "@/components/CohortFillStat";
import Meter from "@/components/Meter";

function Stat({
  label,
  value,
  meter,
}: {
  label: string;
  value: string | number;
  meter?: { value: number; max: number };
}) {
  return (
    <div className="stat-item">
      <span className="stat-label font-mono lowercase">{label}</span>
      <span className="stat-value font-mono">{value}</span>
      {meter && <Meter value={meter.value} max={meter.max} />}
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
        meter={{ value: trustScore, max: 120 }}
      />
    </div>
  );
}
