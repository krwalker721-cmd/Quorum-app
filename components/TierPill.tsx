export type Tier = "free" | "tier_1" | "tier_2";

const TIER_STYLES: Record<Tier, { color: string; label: string }> = {
  free: { color: "#707070", label: "free" },
  tier_1: { color: "#e8702a", label: "tier_1" },
  tier_2: { color: "#22c55e", label: "tier_2" },
};

export default function TierPill({ tier }: { tier: string | null | undefined }) {
  const t = (tier ?? "free") as Tier;
  const style = TIER_STYLES[t] ?? TIER_STYLES.free;
  return (
    <span
      className="font-mono uppercase text-[0.6rem] tracking-wider px-2 py-1 border"
      style={{ borderColor: style.color, color: style.color, letterSpacing: "0.08em" }}
    >
      {style.label}
    </span>
  );
}
