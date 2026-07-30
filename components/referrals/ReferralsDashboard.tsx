"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTier } from "@/contexts/TierContext";
import TerminalFooter from "@/components/ui/TerminalFooter";
import {
  REFERRAL_MILESTONES,
  REFERRAL_LINK_GATES,
  HOW_REFERRALS_WORK,
  type ReferralGateKey,
} from "@/lib/referral-model";

// ─── types ───────────────────────────────────────────────────────────────────

interface ReferralData {
  code: string | null;
  link: string | null;
  totalCount: number;
  activeCount: number;
  monthlyBonus: number;
  bonusIsFree: boolean;
  bonusLabel: string | null;
  bonusLadder: Array<{ min: number; amountOff: number | null; label: string }>;
  memberPrice: number;
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
  activeStripeDiscounts?: string[];
  /** Server's verdict on the link — see isReferralLinkActive(). */
  linkActive: boolean;
  /** Which unlock conditions are met — see checkActivityGates(). */
  gates: Record<ReferralGateKey, boolean> & { allComplete: boolean };
}

// ─── config ──────────────────────────────────────────────────────────────────

// Badges, not discounts. Every referral already pays a month of credit; the
// ladder is recognition on top of that, not a second payout. Defined in
// lib/referral-model.ts so the onboarding pitch renders from the same list —
// the two used to describe different reward schemes.
const MILESTONES = REFERRAL_MILESTONES;

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
        borderRadius: 12,
        animation: "shimmer 1.5s infinite",
        ...style,
      }}
    />
  );
}

function LoadingState() {
  return (
    <div className="page-pad" style={{ padding: "24px", maxWidth: 960, margin: "0 auto" }}>
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

// The real loop, from lib/referral-model.ts. The old version said rewards
// "unlock as milestones hit", which described the badge ladder as the payout and
// left out the thing that actually pays: the standing monthly bonus.
const HOW_IT_WORKS = HOW_REFERRALS_WORK.map((step, i) => ({ n: i + 1, ...step }));

// ─── component ───────────────────────────────────────────────────────────────

export default function ReferralsDashboard() {
  const router = useRouter();
  const { hasFullAccess } = useTier();
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

  // The server decides whether the link is live — isReferralLinkActive() checks
  // all three activity gates. This component used to run its own single-condition
  // check ("has posted at least once"), so the dashboard, the onboarding pitch,
  // and the API each claimed a different unlock rule.
  const linkActive = !!data?.linkActive;

  const handleCopy = useCallback(() => {
    if (!data?.link || !linkActive) return;
    navigator.clipboard.writeText(data.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data, linkActive]);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState />;

  const { link, totalCount, activeCount, monthlyBonus, bonusIsFree, bonusLadder, memberPrice, referrals, gates } = data;

  const nextMilestone = MILESTONES.find((m) => m.count > totalCount);

  const sortedReferrals = [...referrals].sort((a, b) => {
    const orderDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (orderDiff !== 0) return orderDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const conversionPct = totalCount > 0 ? (activeCount / totalCount) * 100 : 0;


  return (
    <div className="page-pad" style={{ padding: "24px", maxWidth: 960, margin: "0 auto" }}>
      {/* ─── header — compact; the topbar already names the page ────────────── */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: SANS, fontSize: 16, fontWeight: 500, color: "#e6edf3", margin: 0, lineHeight: 1.2 }}>
          referrals
        </h1>
        <p style={{ fontFamily: MONO, fontSize: 9, color: "#6e7681", marginTop: 4, letterSpacing: "0.03em" }}>
          bring someone who belongs here
        </p>
      </div>

      {/* ─── lapsed notice ──────────────────────────────────────────────────── */}
      {/* Gated on the entitlement bit: a card-free trial reports tier "free" and
          must not be told its membership has lapsed. */}
      {!hasFullAccess && (
        <div
          style={{
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.22)",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
          className="stack-flex-sm"
        >
          <div>
            <p style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", color: "#f8c56a", marginBottom: 4, letterSpacing: "0.08em" }}>
              // membership lapsed
            </p>
            <p style={{ fontFamily: SANS, fontSize: 13, color: "#8b949e", marginBottom: 0 }}>
              Your referral link is paused while your membership is inactive. Reactivate to keep bringing founders in — and to keep earning your monthly bonus.
            </p>
          </div>
          <span
            onClick={() => router.push("/pricing")}
            style={{ fontFamily: MONO, fontSize: 11, color: "#f8c56a", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Reactivate →
          </span>
        </div>
      )}

      {/* ─── prominent refer CTA ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }} data-tour-id="referrals-link">
        <div
          style={{
            background: "linear-gradient(150deg, rgba(245,158,11,.16), rgba(245,158,11,.03) 60%)",
            border: "0.5px solid rgba(245,158,11,.3)",
            borderRadius: 12,
            padding: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
          className="stack-flex-sm"
        >
          <div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: "#f8c56a",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              your invite link
            </div>
            <p style={{ fontFamily: SANS, fontSize: 14, color: "#f5ede0", margin: 0 }}>
              Bring someone who belongs here. Get rewarded when they stay.
            </p>
            <p style={{ fontFamily: MONO, fontSize: 11, color: "#8b949e", marginTop: 10, letterSpacing: "0.04em" }}>
              {totalCount} invited · <span style={{ color: "#22c55e" }}>{activeCount} joined</span> · <span style={{ color: "#f8c56a" }}>{bonusIsFree ? "free every month" : monthlyBonus > 0 ? `$${monthlyBonus} off/mo` : "no bonus yet"}</span>
            </p>
          </div>
          <button
            onClick={handleCopy}
            disabled={!linkActive}
            style={{
              background: linkActive
                ? "linear-gradient(135deg, rgba(245,158,11,.92), rgba(245,158,11,.72))"
                : "#21262d",
              color: linkActive ? "#1a1204" : "#484f58",
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.06em",
              padding: "12px 24px",
              border: "none",
              borderRadius: 10,
              cursor: linkActive ? "pointer" : "default",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {copied ? "copied ✓" : "copy link →"}
          </button>
        </div>
        {/* Which gates are still open, straight from the server's own answer.
            Replaces a single "make your first post" line that named one of the
            three conditions and got the unlock rule wrong. */}
        {!linkActive && (
          <div
            style={{
              background: "#161b22",
              border: "1px solid #21262d",
              borderRadius: "0 0 10px 10px",
              borderTop: "none",
              padding: "12px 16px",
              marginTop: -2,
            }}
          >
            <p
              style={{
                fontFamily: MONO,
                fontSize: 9,
                textTransform: "uppercase",
                color: "#484f58",
                letterSpacing: "0.1em",
                marginBottom: 8,
              }}
            >
              // unlock your link
            </p>
            {REFERRAL_LINK_GATES.map((gate) => {
              const done = !!gates?.[gate.key];
              return (
                <div
                  key={gate.key}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "3px 0" }}
                >
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: done ? "#22c55e" : "#484f58",
                      flexShrink: 0,
                      width: 12,
                    }}
                  >
                    {done ? "✓" : "○"}
                  </span>
                  <span>
                    <span
                      style={{
                        fontFamily: SANS,
                        fontSize: 12,
                        color: done ? "#6e7681" : "#e6edf3",
                        display: "block",
                        textDecoration: done ? "line-through" : "none",
                      }}
                    >
                      {gate.title}
                    </span>
                    {!done && (
                      <span
                        style={{ fontFamily: SANS, fontSize: 11, color: "#6e7681", display: "block" }}
                      >
                        {gate.sub}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── two-column layout ──────────────────────────────────────────────── */}
      <div className="stack-flex-md" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* LEFT */}
        <div style={{ flex: "1.4", minWidth: 0 }}>
          {/* referral link display */}
          <div
            style={{
              background: "#0d1117",
              border: `1px solid ${linkActive ? "#30363d" : "#21262d"}`,
              borderRadius: 12,
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
                borderRadius: 12,
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
                        borderRadius: 12,
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

          {/* standing bonus + the ladder */}
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 12, padding: 16, marginTop: 16 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, textTransform: "uppercase", color: "#484f58", letterSpacing: "0.08em" }}>
              // your monthly bonus
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 12 }}>
              {bonusIsFree ? (
                <span style={{ fontFamily: SANS, fontSize: 28, color: "#22c55e" }}>free</span>
              ) : (
                <>
                  <span style={{ fontFamily: SANS, fontSize: 28, color: "#f59e0b" }}>${monthlyBonus}</span>
                  <span style={{ fontFamily: SANS, fontSize: 14, color: "#8b949e" }}>off every month</span>
                </>
              )}
            </div>
            <p style={{ fontFamily: MONO, fontSize: 10, color: "#484f58", marginTop: 4 }}>
              // {activeCount} active {activeCount === 1 ? "referral" : "referrals"}
              {!bonusIsFree && monthlyBonus > 0 ? ` · you pay $${memberPrice - monthlyBonus}` : ""}
            </p>

            <div style={{ marginTop: 12, borderTop: "1px solid #21262d", paddingTop: 12 }}>
              {[...bonusLadder].reverse().map((t) => {
                const held = activeCount >= t.min;
                const next = !held && activeCount < t.min;
                const c = held ? "#f59e0b" : next ? "#8b949e" : "#484f58";
                return (
                  <div key={t.min} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
                    <span style={{ fontFamily: SANS, fontSize: 12, color: c }}>
                      {t.min}+ active
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: c }}>
                      {t.amountOff === null ? "free" : `$${t.amountOff} off / mo`}
                    </span>
                  </div>
                );
              })}
            </div>

            <p style={{ fontFamily: SANS, fontSize: 12, color: "#8b949e", marginTop: 12, lineHeight: 1.5 }}>
              Your bonus tracks how many of your referrals are <strong style={{ color: "#e6edf3" }}>still active</strong> —
              it recalculates as people come and go. Fill a room of 12 and Quorum is free.
            </p>
          </div>
        </div>
      </div>
      <TerminalFooter />
    </div>
  );
}
