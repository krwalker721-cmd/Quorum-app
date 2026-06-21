import { STAGE_COLOR } from "@/lib/stage";

// Build an rgba() from a #rrggbb hex so each stage pill can carry a tinted fill
// and a softer border derived from its own accent color.
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function StagePill({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const color = STAGE_COLOR[stage] ?? "#6e7681";
  return (
    <span
      className="font-mono lowercase text-[0.55rem] px-1.5 py-0.5"
      style={{
        border: `1px solid ${hexToRgba(color, 0.3)}`,
        color,
        background: hexToRgba(color, 0.1),
      }}
    >
      {stage}
    </span>
  );
}
