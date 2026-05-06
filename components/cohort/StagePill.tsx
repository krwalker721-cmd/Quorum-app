import { STAGE_COLOR } from "@/lib/stage";

export default function StagePill({ stage }: { stage: string | null }) {
  if (!stage) return null;
  const color = STAGE_COLOR[stage] ?? "#707070";
  return (
    <span
      className="font-mono lowercase text-[0.55rem] px-1.5 py-0.5"
      style={{ border: `1px solid ${color}`, color, background: "transparent" }}
    >
      {stage}
    </span>
  );
}
