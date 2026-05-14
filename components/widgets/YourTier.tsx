import type { Tier } from "@/lib/vault";

const COPY: Record<Tier, { label: string; sub: string; cta: string | null }> = {
  free: {
    label: "free",
    sub: "titles and authors only.",
    cta: "upgrade to tier_2 →",
  },
  tier_1: {
    label: "tier_1",
    sub: "two vault posts unlocked.",
    cta: "upgrade to tier_2 →",
  },
  tier_2: {
    label: "tier_2",
    sub: "full vault access.",
    cta: null,
  },
};

export default function YourTier({ tier }: { tier: Tier }) {
  const c = COPY[tier];
  return (
    <div
      className="p-4 border"
      style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
    >
      <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
        your_tier
      </p>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="font-mono uppercase text-[0.6rem] tracking-wider px-2 py-0.5 border"
          style={{ borderColor: "#f59e0b", color: "#f59e0b", letterSpacing: "0.08em" }}
        >
          {c.label}
        </span>
      </div>
      <p className="font-mono lowercase text-[0.7rem] text-text-muted mb-2">{c.sub}</p>
      {c.cta && (
        <p className="font-mono lowercase text-[0.7rem] text-amber">{c.cta}</p>
      )}
    </div>
  );
}
