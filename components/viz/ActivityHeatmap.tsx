import VizCard from "./VizCard";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
// Four 6-hour slots labeled by their start.
const SLOTS = ["12a", "6a", "12p", "6p"];

function bucketize(timestamps: string[]) {
  // grid[day(0..6)][slot(0..3)]
  const grid: number[][] = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  for (const ts of timestamps) {
    const d = new Date(ts);
    const day = (d.getDay() + 6) % 7; // make Monday=0
    const slot = Math.floor(d.getHours() / 6); // 0..3
    grid[day][slot] += 1;
  }
  return grid;
}

function peakLabel(grid: number[][]) {
  let bestDay = 0, bestSlot = 0, bestVal = -1;
  for (let d = 0; d < 7; d++) {
    for (let s = 0; s < 4; s++) {
      if (grid[d][s] > bestVal) {
        bestVal = grid[d][s];
        bestDay = d;
        bestSlot = s;
      }
    }
  }
  if (bestVal <= 0) return null;
  return `${DAYS[bestDay]}_${SLOTS[bestSlot].replace("a", "am").replace("p", "pm")}`;
}

export default function ActivityHeatmap({
  posts7d,
  timestamps = [],
}: {
  posts7d: number;
  timestamps?: string[];
}) {
  const grid = bucketize(timestamps);
  const max = Math.max(1, ...grid.flat());
  const peak = peakLabel(grid);

  return (
    <VizCard label="activity_heatmap">
      <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${SLOTS.length}, 1fr)` }}>
        <div />
        {SLOTS.map((s) => (
          <div key={s} className="font-mono lowercase text-[0.55rem] text-text-faint text-center">
            {s}
          </div>
        ))}
        {DAYS.flatMap((day, di) => [
          <div key={`l-${day}`} className="font-mono lowercase text-[0.55rem] text-text-faint">
            {day}
          </div>,
          ...SLOTS.map((_, si) => {
            const v = grid[di][si] / max;
            return (
              <div
                key={`${day}-${si}`}
                title={`${grid[di][si]} post${grid[di][si] === 1 ? "" : "s"}`}
                style={{
                  background: `rgba(232, 112, 42,${0.05 + v * 0.75})`,
                  aspectRatio: "1.4 / 1",
                  minHeight: 10,
                  border: "1px solid var(--border)",
                }}
              />
            );
          }),
        ])}
      </div>
      {peak ? (
        <p className="font-mono lowercase text-[0.6rem] text-amber mt-2">â†‘ peak {peak}</p>
      ) : (
        <p className="font-mono lowercase text-[0.6rem] text-text-faint mt-2">no activity yet</p>
      )}
      <p className="font-mono lowercase text-[0.55rem] text-text-faint">{posts7d} posts Â· 7d</p>
    </VizCard>
  );
}
