import VizCard from "./VizCard";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"];
const SLOTS = ["6a", "12p", "6p", "12a"];

// deterministic mock intensity per cell (0..1)
function cellIntensity(d: number, s: number) {
  const seed = (d * 7 + s * 13 + 5) % 11;
  return seed / 10;
}

export default function ActivityHeatmap({ posts7d }: { posts7d: number }) {
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
            const v = cellIntensity(di, si);
            return (
              <div
                key={`${day}-${si}`}
                style={{
                  background: `rgba(245,158,11,${0.05 + v * 0.7})`,
                  aspectRatio: "1.4 / 1",
                  minHeight: 10,
                  border: "1px solid var(--border)",
                }}
              />
            );
          }),
        ])}
      </div>
      <p className="font-mono lowercase text-[0.6rem] text-amber mt-2">↑ peak thu_6pm</p>
      <p className="font-mono lowercase text-[0.55rem] text-text-faint">{posts7d} posts · 7d</p>
    </VizCard>
  );
}
