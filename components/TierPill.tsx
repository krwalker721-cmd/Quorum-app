export type Tier = "free" | "member" | "partner";

const TIER_STYLES: Record<Tier, { color: string; label: string }> = {
  free: { color: "#6e7681", label: "free" },
  member: { color: "#f59e0b", label: "member" },
  partner: { color: "#a78bfa", label: "partner" },
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
