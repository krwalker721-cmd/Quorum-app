"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTier } from "@/contexts/TierContext";
import { createClient } from "@/lib/supabase/client";

// ─── types ───────────────────────────────────────────────────────────────────

interface ReferralData {
  code: string | null;
  link: string | null;
  totalCount: number;
  activeCount: number;
  monthlyBonus: number;
  referrals: Array<{
    id: string;
    status: string;
    activated_at: string | null;
    last_seen_at: string | null;
    created_at: string;
    referred: {
      id: string;
      username: string;
      full_name: string;
      avatar_url: string | null;
      tier: string;
      stage: string | null;
    } | null;
  }>;
  tier: "free" | "member" | "partner";
  referralCap: number | null;
  referralCapReached: boolean;
  activeStripeDiscounts?: string[];
  currentSavings?: number;
}

// ─── config ──────────────────────────────────────────────────────────────────

const MILESTONES = [
  { count: 1, reward: "$10 off next month + Connector badge" },
  { count: 3, reward: "1 free month of Member" },
  { count: 5, reward: "2 free months of Member" },
  { count: 10, reward: "50% off for 6 months" },
  { count: 25, reward: "Member free for 1 year" },
];

const statusStyles = {
  active: {
    background: "rgba(34,197,94,0.10)",
    color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.20)",
  },
  pending: {
    background: "rgba(245,158,11,0.10)",
    color: "#f59e0b",
    border: "1px solid rgba(245,158,11,0.20)",
  },
  inactive: {
    background: "#21262d",
    color: "#8b949e",
    border: "1px solid #30363d",
  },
  churned: {
    background: "#161b22",
    color: "#484f58",
    border: "1px solid #21262d",
  },
};

const MONO = "JetBrains Mono, monospace";
const SANS = "Space Grotesk, sans-serif";

// ─── helpers ─────────────────────────────────────────────────────────────────

function relativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

function getResetDate(): string {
  const now = new Date();
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return firstOfNextMonth.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_ORDER: Record<string, number> = {
  active: 0,
  pending: 1,
  inactive: 2,
  churned: 3,
};

// ─── shared pieces ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const style = statusStyles[status as keyof typeof statusStyles] || statusStyles.inactive;
  return (
    <span
      style={{
        ...style,
        fontFamily: MONO,
        fontSize: "9px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: "3px",
      }}
    >
      {status}
    </span>
  );
}

// ─── loading + error ─────────────────────────────────────────────────────────

function SkeletonBlock({ width, height, style }: { width: string | number; height: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width,
        height,
        background: "#21262d",
        borderRadius: 4,
        animation: "shimmer 1.5s infinite",
        ...style,
      }}
    />
  );
}

function LoadingState() {
  return (
    <div style={{ padding: "24px", maxWidth: 960, margin: "0 auto" }}>
      <style>{`@keyframes shimmer { 0% { opacity: 0.4 } 50% { opacity: 0.7 } 100% { opacity: 0.4 } }`}</style>
      <SkeletonBlock width={200} height={32} style={{ marginBottom: 24 }} />
      <SkeletonBlock width="100%" height={96} style={{ marginBottom: 24 }} />
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ flex: 1.4 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} width="100%" height={80} style={{ marginBottom: 16 }} />
          ))}
        </div>
        <div style={{ flex: 1 }}>
          {[0, 1].map((i) => (
            <SkeletonBlock key={i} width="100%" height={120} style={{ marginBottom: 16 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState() {
  return (
    <div
      style={{
        padding: "80px 24px",
        textAlign: "center",
        fontFamily: MONO,
        fontSize: 13,
        color: "#f85149",
      }}
    >
      // failed to load referral data — try refreshing
    </div>
  );
}

// ─── how it works ────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { n: 1, title: "Share your link", sub: "They sign up and join Quorum" },
  { n: 2, title: "They activate", sub: "They add a card within 48 hours" },
  { n: 3, title: "You earn", sub: "Rewards unlock as milestones hit" },
];

// ─── component ───────────────────────────────────────────────────────────────

export default function ReferralsDashboard() {
  const router = useRouter();
  const { status } = useTier();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  // Whether the user has made at least one post — the sole gate on the link.
  const [hasPosted, setHasPosted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/referrals");
        if (!res.ok) throw new Error("request failed");
        const json = (await res.json()) as ReferralData;
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The link activates once the user has posted at least once (cohort or pulse).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("author_id", user.id);
      if (!cancelled) setHasPosted((count || 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const linkActive = hasPosted && !(data?.referralCapReached ?? false);

  const handleCopy = useCallback(() => {
    if (!data?.link || !linkActive) return;
    navigator.clipboard.writeText(data.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data, linkActive]);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState />;

  const { link, totalCount, activeCount, monthlyBonus, referrals, tier, referralCapReached } = data;

  const currentSavings = data.currentSavings ?? 0;
  const nextMilestone = MILESTONES.find((m) => m.count > totalCount);

  const sortedReferrals = [...referrals].sort((a, b) => {
    const orderDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (orderDiff !== 0) return orderDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const conversionPct = totalCount > 0 ? (activeCount / totalCount) * 100 : 0;

  const bonusTierIndex = activeCount >= 5 ? 2 : activeCount >= 3 ? 1 : activeCount >= 1 ? 0 : -1;
  const bonusRows = [
    { label: "1-2 active referrals", value: "$10 off / month" },
    { label: "3-4 active referrals", value: "$20 off / month" },
    { label: "5+ active referrals", value: "$30 off / month" },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: 960, margin: "0 auto" }}>
      {/* ─── header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "#6e7681", marginBottom: 6 }}>
          // referrals
        </p>
        <h1 style={{ fontFamily: SANS, fontSize: 28, fontWeight: 500, color: "#e6edf3", margin: 0, lineHeight: 1.2 }}>
          referrals
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 14, color: "#8b949e", marginTop: 4 }}>
          bring someone who belongs here
        </p>
      </div>

      {/* ─── free tier cap notice ───────────────────────────────────────────── */}
      {tier === "free" && status !== "trialing" && (
        <div
          style={{
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.22)",
            borderRadius: 4,
            padding: "14px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <p style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", color: "#22c55e", marginBottom: 4, letterSpacing: "0.08em" }}>
              // free tier
            </p>
            <p style={{ fontFamily: SANS, fontSize: 13, color: "#8b949e", marginBottom: 6 }}>
              You can refer up to 3 founders on the free tier. Upgrade to Member for unlimited referrals.
            </p>
            <p style={{ fontFamily: MONO, fontSize: 10, color: "#22c55e" }}>{totalCount} of 3 referrals used</p>
          </div>
          {referralCapReached && (
            <span
              onClick={() => router.push("/pricing")}
              style={{ fontFamily: MONO, fontSize: 11, color: "#22c55e", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Upgrade for unlimited →
            </span>
          )}
        </div>
      )}

      {/* ─── prominent refer CTA ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 4,
            padding: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: "#f59e0b",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              // your invite link
            </div>
            <p style={{ fontFamily: SANS, fontSize: 14, color: "#8b949e", margin: 0 }}>
              Bring someone who belongs here. Get rewarded when they stay.
            </p>
          </div>
          <button
            onClick={handleCopy}
            disabled={!linkActive}
            style={{
              background: linkActive ? "#f59e0b" : "#21262d",
              color: linkActive ? "#0d1117" : "#484f58",
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.06em",
              padding: "12px 24px",
              border: "none",
              borderRadius: 4,
              cursor: linkActive ? "pointer" : "default",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {referralCapReached ? "link paused" : copied ? "copied ✓" : "copy invite link →"}
          </button>
        </div>
        {!hasPosted && (
          <p
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: "#484f58",
              letterSpacing: "0.05em",
              textAlign: "right",
              marginTop: 6,
            }}
          >
            // make your first post to activate
          </p>
        )}
      </div>

      {/* ─── two-column layout ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* LEFT */}
        <div style={{ flex: "1.4", minWidth: 0 }}>
          {/* referral link display */}
          <div
            style={{
              background: "#0d1117",
              border: `1px solid ${linkActive ? "#30363d" : "#21262d"}`,
              borderRadius: 4,
              padding: "10px 14px",
              fontFamily: MONO,
              fontSize: 12,
              color: linkActive ? "#8b949e" : "#484f58",
              letterSpacing: "0.04em",
              marginBottom: 24,
              opacity: linkActive ? 1 : 0.5,
              userSelect: linkActive ? "all" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {link || "quorum.app/signup?ref=••••••"}
          </div>

          {/* how it works */}
          <p style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", color: "#484f58", letterSpacing: "0.1em", marginBottom: 12 }}>
            // how it works
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
            {HOW_IT_WORKS.map((step) => (
              <div key={step.n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "rgba(245,158,11,0.12)",
                    border: "1px solid rgba(245,158,11,0.3)",
                    color: "#f59e0b",
                    fontFamily: MONO,
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {step.n}
                </div>
                <div>
                  <p style={{ fontFamily: SANS, fontSize: 13, color: "#e6edf3", margin: 0 }}>{step.title}</p>
                  <p style={{ fontFamily: SANS, fontSize: 12, color: "#6e7681", margin: 0 }}>{step.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* your referrals */}
          <p style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", color: "#484f58", letterSpacing: "0.1em", marginBottom: 6 }}>
            // your referrals
          </p>
          {referrals.length === 0 ? (
            <div
              style={{
                background: "#161b22",
                border: "1px dashed #30363d",
                borderRadius: 4,
                padding: 32,
                textAlign: "center",
              }}
            >
              <p style={{ fontFamily: MONO, fontSize: 11, color: "#484f58", marginBottom: 8 }}>// no referrals yet</p>
              <p style={{ fontFamily: SANS, fontSize: 13, color: "#6e7681" }}>
                Share your link with founders who belong in this room.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontFamily: MONO, fontSize: 10, color: "#484f58", marginBottom: 6 }}>
                {activeCount} of {totalCount} referrals became active
              </p>
              <div style={{ height: 3, background: "#21262d", borderRadius: 2, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ height: "100%", width: `${conversionPct}%`, background: "#22c55e" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sortedReferrals.map((r) => {
                  const s = r.status;
                  const name = r.referred?.full_name || r.referred?.username || "founder";
                  const username = r.referred?.username ?? "unknown";
                  const initial = (name[0] || "?").toUpperCase();
                  const avatarStyle: React.CSSProperties =
                    s === "active"
                      ? { background: "rgba(34,197,94,0.12)", color: "#22c55e" }
                      : s === "pending"
                      ? { background: "rgba(245,158,11,0.12)", color: "#f59e0b" }
                      : { background: "#21262d", color: "#484f58" };
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        background: "#161b22",
                        border: "1px solid #21262d",
                        borderRadius: 4,
                        padding: "14px 16px",
                      }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            ...avatarStyle,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: MONO,
                            fontSize: 12,
                            flexShrink: 0,
                          }}
                        >
                          {initial}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p
                            style={{
                              fontFamily: SANS,
                              fontSize: 13,
                              color: "#e6edf3",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              margin: 0,
                            }}
                          >
                            {name}
                          </p>
                          <p style={{ fontFamily: MONO, fontSize: 10, color: "#484f58", margin: 0 }}>
                            joined {relativeDate(r.created_at)}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                        {s === "pending" && (
                          <span style={{ fontFamily: MONO, fontSize: 9, color: "#f59e0b" }}>// hasn&apos;t activated yet</span>
                        )}
                        <StatusPill status={s} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* RIGHT (sticky) */}
        <div style={{ flex: "1", position: "sticky", top: 24, minWidth: 0 }}>
          {/* milestones */}
          <p style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", color: "#f59e0b", letterSpacing: "0.12em", marginBottom: 10 }}>
            // referral milestones
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MILESTONES.map((m) => {
              const done = totalCount >= m.count;
              const isTarget = !done && nextMilestone?.count === m.count;
              return (
                <div
                  key={m.count}
                  style={{
                    background: "#161b22",
                    border: "1px solid #21262d",
                    borderLeft: `2px solid ${done ? "#22c55e" : isTarget ? "#f59e0b" : "#21262d"}`,
                    borderRadius: "0 4px 4px 0",
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: done ? "#22c55e" : isTarget ? "#f59e0b" : "#8b949e" }}>
                      {m.count} {m.count === 1 ? "referral" : "referrals"}
                    </span>
                    <p style={{ fontFamily: SANS, fontSize: 11, color: "#6e7681", margin: "2px 0 0" }}>{m.reward}</p>
                  </div>
                  <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                    {done ? (
                      <span style={{ fontFamily: MONO, fontSize: 10, color: "#22c55e" }}>✓ earned</span>
                    ) : isTarget ? (
                      <span style={{ fontFamily: MONO, fontSize: 10, color: "#f59e0b" }}>
                        {totalCount}/{m.count}
                      </span>
                    ) : (
                      <span style={{ fontFamily: MONO, fontSize: 11, color: "#30363d" }}>—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* monthly bonus */}
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 4, padding: 16, marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", color: "#484f58", letterSpacing: "0.08em" }}>
                // monthly bonus
              </span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: "#484f58" }}>resets {getResetDate()}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 12 }}>
              <span style={{ fontFamily: SANS, fontSize: 28, color: "#f59e0b" }}>${monthlyBonus}</span>
              <span style={{ fontFamily: SANS, fontSize: 14, color: "#8b949e" }}>off this month</span>
            </div>
            <p style={{ fontFamily: MONO, fontSize: 10, color: "#484f58", marginTop: 4 }}>// {activeCount} active referrals</p>

            <div style={{ marginTop: 12, borderTop: "1px solid #21262d", paddingTop: 12 }}>
              {bonusRows.map((row, i) => {
                const isActiveTier = i === bonusTierIndex;
                return (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
                    <span style={{ fontFamily: SANS, fontSize: 12, color: isActiveTier ? "#f59e0b" : "#484f58" }}>{row.label}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: isActiveTier ? "#f59e0b" : "#484f58" }}>{row.value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* current savings */}
          {currentSavings > 0 && (
            <div
              style={{
                background: "rgba(34,197,94,0.04)",
                border: "1px solid rgba(34,197,94,0.15)",
                borderRadius: 4,
                padding: "16px 20px",
                marginTop: 16,
              }}
            >
              <p style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#22c55e", marginBottom: 6 }}>
                // your current savings
              </p>
              <p style={{ fontFamily: SANS, fontSize: 16, color: "#22c55e", margin: 0 }}>
                ${currentSavings.toFixed(2)} off this month
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
