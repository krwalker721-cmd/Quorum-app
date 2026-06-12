/**
 * Continuous capacity/score gauge used in the stat strip and anywhere a
 * segmented bar used to live. Quarter tick marks come from the .meter CSS.
 */
export default function Meter({ value, max = 1 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  return (
    <div className="meter" role="img" aria-label={`${Math.round(pct)}%`}>
      <div className="meter-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
