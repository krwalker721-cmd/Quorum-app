import VizCard from "./VizCard";

const STAGES: { key: string; label: string }[] = [
  { key: "idea", label: "idea" },
  { key: "pre-seed", label: "pre-seed" },
  { key: "seed", label: "seed" },
  { key: "series_a", label: "series_a" },
];

export default function StageBreakdown({ counts }: { counts: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(counts));
  return (
    <VizCard label="stage_breakdown">
      <div className="space-y-2.5">
        {STAGES.map((s) => {
          const n = counts[s.key] ?? 0;
          const pct = (n / max) * 100;
          return (
            <div key={s.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono lowercase text-[0.65rem] text-text-muted">{s.label}</span>
                <span className="font-mono lowercase text-[0.65rem] text-text-faint">{n}</span>
              </div>
              <div
                style={{
                  height: 8,
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: "#e8702a",
                    opacity: n === 0 ? 0.05 : 0.25 + 0.75 * (n / max),
                    transition: "width 200ms ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </VizCard>
  );
}
