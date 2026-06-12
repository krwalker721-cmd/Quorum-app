import VizCard from "./VizCard";

// Stage identity colors from the design system — idea teal, pre-seed amber,
// seed green, series A purple. Bars carry the stage color so the chart reads
// the same way stage pills and avatar rings do everywhere else.
const STAGES: { key: string; label: string; color: string }[] = [
  { key: "idea", label: "idea", color: "#38bdf8" },
  { key: "pre-seed", label: "pre-seed", color: "#f59e0b" },
  { key: "seed", label: "seed", color: "#22c55e" },
  { key: "series_a", label: "series_a", color: "#a78bfa" },
];

export default function StageBreakdown({ counts }: { counts: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(counts));
  const total = STAGES.reduce((sum, s) => sum + (counts[s.key] ?? 0), 0);

  return (
    <VizCard label="stage_breakdown" meta={`${total} founders`}>
      <div className="space-y-3">
        {STAGES.map((s) => {
          const n = counts[s.key] ?? 0;
          const pct = (n / max) * 100;
          const share = total > 0 ? Math.round((n / total) * 100) : 0;
          return (
            <div key={s.key}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-mono lowercase" style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                  {s.label}
                </span>
                <span className="font-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {n}
                  <span style={{ color: "var(--text-faint)", marginLeft: 6, fontSize: 9 }}>
                    {share}%
                  </span>
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "var(--bg-overlay)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${s.color}88, ${s.color})`,
                    opacity: n === 0 ? 0 : 1,
                    transition: "width 400ms cubic-bezier(0.22, 1, 0.36, 1)",
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
