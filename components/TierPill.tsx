export type Tier = "free" | "member" | "partner";

// What the pill can display. "trial" is not a tier — a card-free trial stores
// tier "free" — but showing "free" to someone with a live trial and full access
// is a lie the sidebar used to tell, so the pill can render that state directly.
type PillState = Tier | "trial";

// Filled pill per the payments design spec. Free and member pull from theme
// tokens so the high-contrast theme remaps them; partner uses its purple accent
// (no token exists for it yet).
const TIER_STYLES: Record<PillState, { background: string; color: string; border: string; label: string }> = {
  free: {
    background: "var(--bg-overlay)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-muted)",
    label: "free",
  },
  trial: {
    background: "rgba(34,197,94,0.10)",
    color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.28)",
    label: "trial",
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

export default function TierPill({
  tier,
  sleek = false,
}: {
  tier: string | null | undefined;
  /** The landing page's finish: rounded, sentence case, readable size. Opt-in
   *  while it rolls out (the sidebar first); other uses keep the mono pill. */
  sleek?: boolean;
}) {
  const t = (tier ?? "free") as PillState;
  const style = TIER_STYLES[t] ?? TIER_STYLES.free;
  return (
    <span
      className={sleek ? "" : "font-mono uppercase"}
      style={{
        background: style.background,
        color: style.color,
        border: style.border,
        fontSize: sleek ? 11 : 9,
        fontWeight: sleek ? 500 : undefined,
        letterSpacing: sleek ? 0 : "0.1em",
        padding: sleek ? "3px 9px" : "4px 10px",
        borderRadius: sleek ? 9999 : 3,
        display: "inline-block",
        lineHeight: sleek ? 1.3 : 1,
      }}
    >
      {sleek ? style.label.charAt(0).toUpperCase() + style.label.slice(1) : style.label}
    </span>
  );
}
