"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTier } from "@/contexts/TierContext";

// ─── types ───────────────────────────────────────────────────────────────────

interface ReferralData {
  code: string | null;
  link: string | null;
  linkActive: boolean;
  linkActiveReason?: string;
  gates: {
    profileComplete: boolean;
    returnedThreeDays: boolean;
    engagedWithPulse: boolean;
    allComplete: boolean;
  };
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
  rewards: Array<{
    id: string;
    reward_type: string;
    milestone_count: number | null;
    applied_at: string;
    expires_at: string | null;
    active: boolean;
  }>;
  tier: "free" | "member" | "partner";
  referralCap: number | null;
  referralCapReached: boolean;
  activeStripeDiscounts?: string[];
  currentSavings?: number;
}

// ─── config ──────────────────────────────────────────────────────────────────

const MILESTONES = [
  { count: 1, reward: "$10 off next month + Connector badge", type: "milestone_1" },
  { count: 3, reward: "1 free month of Member", type: "milestone_3" },
  { count: 5, reward: "2 free months of Member", type: "milestone_5" },
  { count: 10, reward: "50% off for 6 months", type: "milestone_10" },
  { count: 25, reward: "Member free for 1 year", type: "milestone_25" },
];

// marker positions as a percentage of the 25-referral track
const MILESTONE_MARKERS = [4, 12, 20, 40, 100];

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
    <div style={{ padding: "24px", maxWidth: 760, margin: "0 auto" }}>
      <style>{`@keyframes shimmer { 0% { opacity: 0.4 } 50% { opacity: 0.7 } 100% { opacity: 0.4 } }`}</style>
      <SkeletonBlock width={200} height={32} style={{ marginBottom: 24 }} />
      {[0, 1, 2, 3].map((i) => (
        <SkeletonBlock key={i} width="100%" height={80} style={{ marginBottom: 16 }} />
      ))}
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

// ─── component ───────────────────────────────────────────────────────────────

export default function ReferralsDashboard() {
  const router = useRouter();
  const { status } = useTier();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const handleCopy = useCallback(() => {
    if (!data?.link || data.referralCapReached) return;
    navigator.clipboard.writeText(data.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data]);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState />;

  const {
    code,
    link,
    gates,
    totalCount,
    activeCount,
    monthlyBonus,
    referrals,
    tier,
    referralCapReached,
  } = data;

  const currentSavings = data.currentSavings ?? 0;

  const nextMilestone = MILESTONES.find((m) => m.count > totalCount);
  const milestoneFill = Math.min((totalCount / 25) * 100, 100);

  const sortedReferrals = [...referrals].sort((a, b) => {
    const orderDiff =
      (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (orderDiff !== 0) return orderDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const conversionPct = totalCount > 0 ? (activeCount / totalCount) * 100 : 0;

  // monthly bonus tier rows
  const bonusTierIndex =
    activeCount >= 5 ? 2 : activeCount >= 3 ? 1 : activeCount >= 1 ? 0 : -1;
  const bonusRows = [
    { label: "1-2 active referrals", value: "$10 off / month" },
    { label: "3-4 active referrals", value: "$20 off / month" },
    { label: "5+ active referrals", value: "$30 off / month" },
  ];

  // activity gate steps
  const steps = [
    {
      n: 1,
      label: "complete profile",
      sub: "stage, bio, and skills filled out",
      done: gates.profileComplete,
    },
    {
      n: 2,
      label: "return 3 days",
      sub: "log in on 3 separate days",
      done: gates.returnedThreeDays,
    },
    {
      n: 3,
      label: "engage with pulse",
      sub: "post or reply to a pulse post",
      done: gates.engagedWithPulse,
    },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: 760, margin: "0 auto" }}>
      {/* ─── Section 1 — header ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <p
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.08em",
            color: "#6e7681",
            marginBottom: 6,
          }}
        >
          // referrals
        </p>
        <h1
          style={{
            fontFamily: SANS,
            fontSize: 28,
            fontWeight: 500,
            color: "#e6edf3",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          referrals
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 14, color: "#8b949e", marginTop: 4 }}>
          bring someone who belongs here
        </p>
      </div>

      {/* ─── Section 2 — free tier cap notice ───────────────────────────────── */}
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
            <p
              style={{
                fontFamily: MONO,
                fontSize: 9,
                textTransform: "uppercase",
                color: "#22c55e",
                marginBottom: 4,
                letterSpacing: "0.08em",
              }}
            >
              // free tier
            </p>
            <p style={{ fontFamily: SANS, fontSize: 13, color: "#8b949e", marginBottom: 6 }}>
              You can refer up to 3 founders on the free tier. Upgrade to Member for
              unlimited referrals.
            </p>
            <p style={{ fontFamily: MONO, fontSize: 10, color: "#22c55e" }}>
              {totalCount} of 3 referrals used
            </p>
          </div>
          {referralCapReached && (
            <span
              onClick={() => router.push("/pricing")}
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: "#22c55e",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Upgrade for unlimited →
            </span>
          )}
        </div>
      )}

      {/* ─── Section 3 — activity gate track ────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <p
          style={{
            fontFamily: MONO,
            fontSize: 10,
            textTransform: "uppercase",
            color: "#f59e0b",
            letterSpacing: "0.12em",
            marginBottom: 6,
          }}
        >
          // earn your invite link
        </p>
        <p style={{ fontFamily: SANS, fontSize: 13, color: "#8b949e", marginBottom: 20 }}>
          quorum stays valuable because everyone in it earns their place. complete these
          steps to unlock your referral link.
        </p>

        {gates.allComplete ? (
          <div
            style={{
              background: "rgba(34,197,94,0.06)",
              border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: 4,
              padding: "12px 16px",
              marginBottom: 20,
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 11, color: "#22c55e" }}>
              // your referral link is now active
            </span>
          </div>
        ) : (
          <>
            {/* The three gates are independent — they can be completed in any
                order. Rendered as standalone cards (no connector line) so the
                layout doesn't imply a sequence. */}
            <p
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: "#484f58",
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              // complete all three in any order
            </p>
            <div style={{ maxWidth: 560 }}>
              {steps.map((step) => (
                <div
                  key={step.n}
                  style={{
                    background: "#161b22",
                    border: `1px solid ${step.done ? "rgba(34,197,94,0.3)" : "#21262d"}`,
                    borderLeft: `2px solid ${step.done ? "#22c55e" : "#21262d"}`,
                    borderRadius: "0 4px 4px 0",
                    padding: "12px 14px",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 10,
                        color: step.done ? "#22c55e" : "#484f58",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {step.label}
                    </span>
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 9,
                        color: step.done ? "#22c55e" : "#484f58",
                      }}
                    >
                      {step.done ? "✓ done" : "// pending"}
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: SANS,
                      fontSize: 12,
                      color: "#6e7681",
                      marginTop: 4,
                    }}
                  >
                    {step.sub}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─── Section 4 — referral link ──────────────────────────────────────── */}
      {gates.allComplete && (
        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 4,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                textTransform: "uppercase",
                color: "#484f58",
              }}
            >
              // your invite link
            </span>
            {referralCapReached && (
              <span style={{ fontFamily: MONO, fontSize: 9, color: "#f85149" }}>
                // link paused — cap reached
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <input
              readOnly
              value={link ?? ""}
              style={{
                flex: 1,
                background: "#0d1117",
                border: "1px solid #21262d",
                borderRadius: 4,
                padding: "10px 14px",
                fontFamily: MONO,
                fontSize: 12,
                color: "#8b949e",
                letterSpacing: "0.04em",
                cursor: "default",
                userSelect: "all",
                opacity: referralCapReached ? 0.4 : 1,
                pointerEvents: referralCapReached ? "none" : "auto",
              }}
            />
            <button
              onClick={handleCopy}
              disabled={referralCapReached}
              style={{
                background: referralCapReached ? "#21262d" : "#f59e0b",
                color: referralCapReached ? "#484f58" : "#0d1117",
                fontFamily: MONO,
                fontSize: 11,
                letterSpacing: "0.06em",
                padding: "10px 18px",
                border: "none",
                borderRadius: 4,
                cursor: referralCapReached ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {referralCapReached ? "link paused" : copied ? "copied ✓" : "copy link →"}
            </button>
          </div>

          <p style={{ fontFamily: MONO, fontSize: 10, color: "#484f58", marginTop: 10 }}>
            // your code: {code}
          </p>

          <div
            style={{
              marginTop: 14,
              borderTop: "1px solid #21262d",
              paddingTop: 14,
            }}
          >
            <p style={{ fontFamily: SANS, fontSize: 12, color: "#6e7681" }}>
              Founders who join with your link get a 30-day trial and their first month
              free when they add a card.
            </p>
          </div>
        </div>
      )}

      {/* ─── Section 5 — milestones ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <p
          style={{
            fontFamily: MONO,
            fontSize: 10,
            textTransform: "uppercase",
            color: "#f59e0b",
            letterSpacing: "0.12em",
            marginBottom: 6,
          }}
        >
          // referral milestones
        </p>
        <p style={{ fontFamily: SANS, fontSize: 13, color: "#8b949e", marginBottom: 20 }}>
          every founder you bring who stays active builds the network and earns you
          access.
        </p>

        {/* progress bar with markers */}
        <div style={{ position: "relative", maxWidth: 560, marginBottom: 24, height: 12 }}>
          <div
            style={{
              position: "absolute",
              top: 4,
              left: 0,
              width: "100%",
              height: 4,
              background: "#21262d",
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 4,
              left: 0,
              width: `${milestoneFill}%`,
              height: 4,
              background: "#f59e0b",
              borderRadius: 2,
            }}
          />
          {MILESTONES.map((m, i) => {
            const done = totalCount >= m.count;
            const isTarget = nextMilestone?.count === m.count;
            const size = isTarget ? 12 : 10;
            const markerBg = done ? "#22c55e" : isTarget ? "#f59e0b" : "#21262d";
            return (
              <div
                key={m.count}
                style={{
                  position: "absolute",
                  left: `${MILESTONE_MARKERS[i]}%`,
                  top: 6,
                  transform: "translate(-50%, -50%)",
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  background: markerBg,
                  border: !done && !isTarget ? "1px solid #30363d" : "none",
                  boxShadow: isTarget ? "0 0 0 3px rgba(245,158,11,0.2)" : "none",
                  zIndex: 1,
                }}
              />
            );
          })}
        </div>

        {/* milestone cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MILESTONES.map((m) => {
            const done = totalCount >= m.count;
            const isTarget = !done && nextMilestone?.count === m.count;
            const isFuture = !done && !isTarget;

            const badgeStyle: React.CSSProperties = done
              ? {
                  background: "rgba(34,197,94,0.1)",
                  color: "#22c55e",
                  border: "1px solid rgba(34,197,94,0.2)",
                }
              : isTarget
              ? {
                  background: "rgba(245,158,11,0.1)",
                  color: "#f59e0b",
                  border: "1px solid rgba(245,158,11,0.2)",
                }
              : { background: "#21262d", color: "#484f58", border: "1px solid #30363d" };

            return (
              <div
                key={m.count}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: isTarget ? "rgba(245,158,11,0.02)" : "#161b22",
                  border: "1px solid #21262d",
                  borderLeft: done
                    ? "2px solid #22c55e"
                    : isTarget
                    ? "2px solid #f59e0b"
                    : "1px solid #21262d",
                  borderRadius: 4,
                  padding: "14px 16px",
                  opacity: isFuture ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    ...badgeStyle,
                    fontFamily: MONO,
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 3,
                    whiteSpace: "nowrap",
                  }}
                >
                  {done ? `${m.count} ✓` : m.count}
                </span>
                <span
                  style={{
                    fontFamily: SANS,
                    fontSize: 13,
                    color: "#8b949e",
                    marginLeft: 12,
                  }}
                >
                  {m.reward}
                </span>
                <span style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
                  {done ? (
                    <span style={{ fontFamily: MONO, fontSize: 9, color: "#22c55e" }}>
                      reward applied
                    </span>
                  ) : isTarget ? (
                    <span style={{ fontFamily: MONO, fontSize: 9, color: "#f59e0b" }}>
                      {totalCount} / {m.count}
                    </span>
                  ) : (
                    <span style={{ fontFamily: MONO, fontSize: 11, color: "#30363d" }}>—</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Section 6 — monthly active bonus ───────────────────────────────── */}
      <div
        style={{
          background: "#161b22",
          border: "1px solid #21262d",
          borderRadius: 4,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              textTransform: "uppercase",
              color: "#484f58",
            }}
          >
            // monthly active bonus
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: "#484f58" }}>
            resets {getResetDate()}
          </span>
        </div>

        <div style={{ marginTop: 12, marginBottom: 16 }}>
          {monthlyBonus > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: SANS, fontSize: 32, color: "#f59e0b" }}>
                  ${monthlyBonus}
                </span>
                <span style={{ fontFamily: SANS, fontSize: 14, color: "#8b949e" }}>
                  off this month
                </span>
              </div>
              <p style={{ fontFamily: MONO, fontSize: 10, color: "#484f58", marginTop: 4 }}>
                // {activeCount} active referrals
              </p>
            </>
          ) : (
            <>
              <p style={{ fontFamily: MONO, fontSize: 11, color: "#484f58" }}>
                // no active referrals this month
              </p>
              <p style={{ fontFamily: SANS, fontSize: 12, color: "#6e7681", marginTop: 4 }}>
                Get 1 active referral to earn $10 off every month.
              </p>
            </>
          )}
        </div>

        <div style={{ marginTop: 12, borderTop: "1px solid #21262d", paddingTop: 12 }}>
          {bonusRows.map((row, i) => {
            const isActiveTier = i === bonusTierIndex;
            return (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                }}
              >
                <span
                  style={{
                    fontFamily: SANS,
                    fontSize: 12,
                    color: isActiveTier ? "#f59e0b" : "#484f58",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {isActiveTier && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#f59e0b",
                        display: "inline-block",
                      }}
                    />
                  )}
                  {row.label}
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: isActiveTier ? "#f59e0b" : "#484f58",
                  }}
                >
                  {row.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Section 6b — current savings ───────────────────────────────────── */}
      {currentSavings > 0 && (
        <div
          style={{
            background: "rgba(34,197,94,0.04)",
            border: "1px solid rgba(34,197,94,0.15)",
            borderRadius: 4,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#22c55e",
            }}
          >
            // your current savings
          </span>
          <span style={{ fontFamily: SANS, fontSize: 16, color: "#22c55e" }}>
            ${currentSavings.toFixed(2)} off this month
          </span>
        </div>
      )}

      {/* ─── Section 7 — your referrals ─────────────────────────────────────── */}
      {(gates.allComplete || referrals.length > 0) && (
        <div>
          <p
            style={{
              fontFamily: MONO,
              fontSize: 10,
              textTransform: "uppercase",
              color: "#484f58",
              letterSpacing: "0.1em",
              marginBottom: 6,
            }}
          >
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
              <p style={{ fontFamily: MONO, fontSize: 11, color: "#484f58", marginBottom: 8 }}>
                // no referrals yet
              </p>
              <p style={{ fontFamily: SANS, fontSize: 13, color: "#6e7681" }}>
                Share your link with founders who belong in this room.
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontFamily: MONO, fontSize: 10, color: "#484f58", marginBottom: 6 }}>
                  {activeCount} of {totalCount} referrals became active members
                </p>
                <div
                  style={{
                    height: 3,
                    background: "#21262d",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${conversionPct}%`,
                      background: "#22c55e",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sortedReferrals.map((r) => {
                  const status = r.status;
                  const name =
                    r.referred?.full_name || r.referred?.username || "founder";
                  const username = r.referred?.username ?? "unknown";
                  const initial = (name[0] || "?").toUpperCase();
                  const avatarStyle: React.CSSProperties =
                    status === "active"
                      ? { background: "rgba(34,197,94,0.12)", color: "#22c55e" }
                      : status === "pending"
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
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
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
                            }}
                          >
                            {name}
                          </p>
                          <p style={{ fontFamily: MONO, fontSize: 10, color: "#484f58" }}>
                            @{username}
                          </p>
                        </div>
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: 10,
                            color: "#484f58",
                            marginLeft: 12,
                            whiteSpace: "nowrap",
                          }}
                        >
                          joined {relativeDate(r.created_at)}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        {status === "pending" && (
                          <span style={{ fontFamily: MONO, fontSize: 9, color: "#f59e0b" }}>
                            // awaiting card
                          </span>
                        )}
                        <StatusPill status={status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
