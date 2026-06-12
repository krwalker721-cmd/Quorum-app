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

// Five-step amber intensity ramp — zero gets a near-invisible neutral cell so
// the grid still reads as a grid without competing with real signal.
function cellColor(v: number, max: number) {
  if (v <= 0) return "rgba(255, 255, 255, 0.03)";
  const t = v / max; // 0..1
  return `rgba(245, 158, 11, ${0.14 + t * 0.66})`;
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
    <VizCard label="activity_heatmap" meta={`${posts7d} posts · 7d`}>
      <div
        className="grid"
        style={{ gridTemplateColumns: `auto repeat(${SLOTS.length}, 1fr)`, gap: 3 }}
      >
        <div />
        {SLOTS.map((s) => (
          <div
            key={s}
            className="font-mono lowercase text-center"
            style={{ fontSize: 8, color: "var(--text-faint)", paddingBottom: 2 }}
          >
            {s}
          </div>
        ))}
        {DAYS.flatMap((day, di) => [
          <div
            key={`l-${day}`}
            className="font-mono lowercase flex items-center"
            style={{ fontSize: 8, color: "var(--text-faint)", paddingRight: 4 }}
          >
            {day}
          </div>,
          ...SLOTS.map((_, si) => {
            const n = grid[di][si];
            return (
              <div
                key={`${day}-${si}`}
                title={`${day} ${SLOTS[si]} — ${n} post${n === 1 ? "" : "s"}`}
                style={{
                  background: cellColor(n, max),
                  aspectRatio: "1.5 / 1",
                  minHeight: 10,
                  borderRadius: 2,
                }}
              />
            );
          }),
        ])}
      </div>

      {/* Footer: peak reading + intensity ramp */}
      <div
        className="flex items-center justify-between mt-3 pt-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {peak ? (
          <span className="font-mono lowercase" style={{ fontSize: 9, color: "#f59e0b" }}>
            peak {peak}
          </span>
        ) : (
          <span className="font-mono lowercase" style={{ fontSize: 9, color: "var(--text-faint)" }}>
            no activity yet
          </span>
        )}
        <span className="flex items-center gap-1" aria-hidden>
          <span className="font-mono" style={{ fontSize: 8, color: "var(--text-faint)" }}>less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span
              key={t}
              style={{
                width: 7,
                height: 7,
                borderRadius: 2,
                background: t === 0 ? "rgba(255,255,255,0.03)" : `rgba(245, 158, 11, ${0.14 + t * 0.66})`,
              }}
            />
          ))}
          <span className="font-mono" style={{ fontSize: 8, color: "var(--text-faint)" }}>more</span>
        </span>
      </div>
    </VizCard>
  );
}
