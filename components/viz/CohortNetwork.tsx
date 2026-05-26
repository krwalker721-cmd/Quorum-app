import VizCard from "./VizCard";
import { STAGE_COLOR } from "@/lib/stage";

type Member = { id: string; full_name: string | null; stage: string | null };

export default function CohortNetwork({ members }: { members: Member[] }) {
  const cohort = members.slice(0, 6);
  const pulse = members.slice(6, 12);
  const cx = 100;
  const cy = 80;
  const ringR1 = 45;
  const ringR2 = 70;

  const pos = (i: number, total: number, r: number) => {
    const angle = (i / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  };

  return (
    <VizCard label="cohort_network">
      <svg viewBox="0 0 200 160" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {cohort.map((m, i) => {
          const p = pos(i, cohort.length, ringR1);
          return (
            <line
              key={`c-line-${m.id}`}
              x1={cx} y1={cy} x2={p.x} y2={p.y}
              stroke="#f59e0b" strokeWidth="0.8" opacity="0.6"
            />
          );
        })}
        {pulse.map((m, i) => {
          const p = pos(i, pulse.length, ringR2);
          return (
            <line
              key={`p-line-${m.id}`}
              x1={cx} y1={cy} x2={p.x} y2={p.y}
              stroke="#6e7681" strokeWidth="0.5" opacity="0.4"
            />
          );
        })}
        {cohort.map((m, i) => {
          const p = pos(i, cohort.length, ringR1);
          return (
            <circle
              key={`c-${m.id}`}
              cx={p.x} cy={p.y} r="3"
              fill={(m.stage && STAGE_COLOR[m.stage]) || "#6e7681"}
            />
          );
        })}
        {pulse.map((m, i) => {
          const p = pos(i, pulse.length, ringR2);
          return (
            <circle
              key={`p-${m.id}`}
              cx={p.x} cy={p.y} r="2"
              fill="#6e7681" opacity="0.7"
            />
          );
        })}
        <circle cx={cx} cy={cy} r="5" fill="#f59e0b" />
        <circle cx={cx} cy={cy} r="9" fill="none" stroke="#f59e0b" strokeWidth="0.5" opacity="0.4" />
      </svg>
      <p className="font-mono lowercase text-[0.6rem] text-text-faint mt-2">
        you Â· {cohort.length} cohort Â· {pulse.length} pulse
      </p>
    </VizCard>
  );
}
