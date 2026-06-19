export type Tier = "free" | "member" | "partner";

// Filled pill per the payments design spec. Free and member pull from theme
// tokens so the high-contrast theme remaps them; partner uses its purple accent
// (no token exists for it yet).
const TIER_STYLES: Record<Tier, { background: string; color: string; border: string; label: string }> = {
  free: {
    background: "var(--bg-overlay)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-muted)",
    label: "free",
  },
  member: {
    background: "var(--accent-bg)",
    color: "var(--accent)",
    border: "1px solid var(--accent-border)",
    label: "member",
  },
  partner: {
    background: "rgba(167,139,250,0.1)",
    color: "#a78bfa",
    border: "1px solid rgba(167,139,250,0.3)",
    label: "partner",
  },
};

export default function TierPill({ tier }: { tier: string | null | undefined }) {
  const t = (tier ?? "free") as Tier;
  const style = TIER_STYLES[t] ?? TIER_STYLES.free;
  return (
    <span
      className="font-mono uppercase"
      style={{
        background: style.background,
        color: style.color,
        border: style.border,
        fontSize: 9,
        letterSpacing: "0.1em",
        padding: "4px 10px",
        borderRadius: 3,
        display: "inline-block",
        lineHeight: 1,
      }}
    >
      {style.label}
    </span>
  );
}
