"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTier } from "@/contexts/TierContext";
import NoGrid from "@/components/ui/NoGrid";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";
import { parseDbTime } from "@/lib/stage";
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

// The real loop, from lib/referral-model.ts. The old version said rewards
// "unlock as milestones hit", which described the badge ladder as the payout and
// left out the thing that actually pays: the standing monthly bonus.
const HOW_IT_WORKS = HOW_REFERRALS_WORK.map((step, i) => ({ n: i + 1, ...step }));

const STATUS_ORDER: Record<string, number> = {
  active: 0,
  pending: 1,
  inactive: 2,
  churned: 3,
};

const STATUS_CHIP: Record<string, React.CSSProperties> = {
  active: { color: "#4ade80", borderColor: "rgba(34, 197, 94, 0.35)", background: "rgba(34, 197, 94, 0.08)" },
  pending: { color: "#f8c56a", borderColor: "rgba(245, 158, 11, 0.35)", background: "rgba(245, 158, 11, 0.08)" },
  inactive: {},
  churned: { color: "var(--text-muted)" },
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  pending: "Pending",
  inactive: "Inactive",
  churned: "Left",
};

const MUTED: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)" };

// ─── helpers ─────────────────────────────────────────────────────────────────

// created_at can arrive zoneless (UTC); parseDbTime reads it as UTC.
function relativeDate(dateString: string): string {
  const diffMs = Date.now() - parseDbTime(dateString).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

// ─── loading + error ─────────────────────────────────────────────────────────

function SkeletonBlock({ height, style }: { height: number; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{ height, borderRadius: 12, background: "rgba(255, 255, 255, 0.04)", ...style }}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`page-pad ${ui.pageGlow}`}
      style={{ padding: "28px 32px 40px", maxWidth: 1280, margin: "0 auto" }}
    >
      <NoGrid />
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <Shell>
      <SkeletonBlock height={34} style={{ width: 200, marginBottom: 24 }} />
      <SkeletonBlock height={150} style={{ marginBottom: 16 }} />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4">
        <SkeletonBlock height={260} />
        <SkeletonBlock height={260} />
      </div>
    </Shell>
  );
}

function ErrorState() {
  return (
    <Shell>
      <p style={{ fontSize: 14, color: "#f87171", padding: "48px 0", textAlign: "center" }}>
        Couldn&apos;t load your referrals. Try refreshing.
      </p>
    </Shell>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

export default function ReferralsDashboard() {
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
    return parseDbTime(b.created_at).getTime() - parseDbTime(a.created_at).getTime();
  });

  const conversionPct = totalCount > 0 ? (activeCount / totalCount) * 100 : 0;
  const bonusText = bonusIsFree
    ? "Free every month"
    : monthlyBonus > 0
      ? `$${monthlyBonus} off a month`
      : "No bonus yet";

  return (
    <Shell>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1
          className={ui.titleGradient}
          style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}
        >
          Referrals
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>
          Bring someone who belongs here. Your membership gets cheaper while they stay.
        </p>
      </div>

      {/* Lapsed notice. Gated on the entitlement bit: a card-free trial reports
          tier "free" and must not be told its membership has lapsed. */}
      {!hasFullAccess && (
        <div
          className="flex items-center justify-between gap-4 flex-wrap"
          style={{
            background: "rgba(245, 158, 11, 0.05)",
            border: "1px solid rgba(245, 158, 11, 0.22)",
            borderRadius: 12,
            padding: "14px 18px",
            marginBottom: 16,
          }}
        >
          <div className="min-w-0" style={{ flex: "1 1 320px" }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#f8c56a" }}>Membership lapsed</p>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)", marginTop: 2 }}>
              Your referral link is paused while your membership is inactive. Reactivate to keep
              bringing founders in, and to keep your monthly bonus.
            </p>
          </div>
          <Link href="/pricing" className={ui.softBtn}>
            Reactivate →
          </Link>
        </div>
      )}

      {/* Invite link: the one hero tile on the page */}
      <div data-tour-id="referrals-link" style={{ marginBottom: 16 }}>
        <Tile gradient kicker="Your invite link" kickerColor="#f8c56a" padding="22px 24px">
          <p style={{ fontSize: 15, color: "var(--text-primary)" }}>
            Bring someone who belongs here. Get rewarded when they stay.
          </p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
            {totalCount} invited · <span style={{ color: "#4ade80" }}>{activeCount} joined</span> ·{" "}
            <span style={{ color: "#f8c56a" }}>{bonusText}</span>
          </p>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap" style={{ marginTop: 16 }}>
            <div
              className="flex-1 min-w-0 truncate"
              style={{
                fontSize: 13,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(0, 0, 0, 0.2)",
                color: linkActive ? "var(--text-secondary)" : "var(--text-muted)",
                userSelect: linkActive ? "all" : "none",
                flexBasis: 240,
              }}
            >
              {linkActive && link ? link : "Your link appears here once it unlocks."}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!linkActive}
              className={ui.primaryBtn}
              style={{ padding: "10px 18px" }}
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>

          {/* Which gates are still open, straight from the server's own answer.
              Replaces a single "make your first post" line that named one of the
              three conditions and got the unlock rule wrong. */}
          {!linkActive && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(245, 158, 11, 0.18)" }}>
              <p className={ui.label} style={{ marginBottom: 8 }}>
                Unlock your link
              </p>
              <div className="space-y-2">
                {REFERRAL_LINK_GATES.map((gate) => {
                  const done = !!gates?.[gate.key];
                  return (
                    <div key={gate.key} className="flex gap-2.5 items-start">
                      <span
                        aria-hidden
                        style={{ fontSize: 13, width: 14, flexShrink: 0, color: done ? "#4ade80" : "var(--text-muted)" }}
                      >
                        {done ? "✓" : "○"}
                      </span>
                      <span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 14,
                            color: done ? "var(--text-muted)" : "var(--text-primary)",
                            textDecoration: done ? "line-through" : "none",
                          }}
                        >
                          {gate.title}
                          <span className="sr-only">{done ? " (done)" : " (not yet)"}</span>
                        </span>
                        {!done && (
                          <span style={{ display: "block", fontSize: 13, color: "var(--text-muted)" }}>
                            {gate.sub}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Tile>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 items-start">
        {/* LEFT */}
        <div className="min-w-0 space-y-4">
          <Tile kicker="How it works">
            <div className="space-y-3.5">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.n} className="flex gap-3 items-start">
                  <div
                    aria-hidden
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "rgba(245, 158, 11, 0.1)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      color: "#f8c56a",
                      fontSize: 12,
                    }}
                  >
                    {step.n}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, color: "var(--text-primary)" }}>{step.title}</p>
                    <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)", marginTop: 1 }}>
                      {step.sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Tile>

          <Tile
            kicker="Your referrals"
            right={totalCount > 0 ? `${activeCount} of ${totalCount} active` : undefined}
          >
            {referrals.length === 0 ? (
              <div className={ui.empty}>
                <p className={ui.emptyTitle}>No referrals yet.</p>
                <p className={ui.emptySub}>Share your link with founders who belong in this room.</p>
              </div>
            ) : (
              <>
                <div className={ui.barTrack} style={{ marginBottom: 14 }}>
                  <div className={ui.barFill} style={{ width: `${conversionPct}%`, background: "#22c55e" }} />
                </div>
                <div className="space-y-1" style={{ margin: "0 -10px" }}>
                  {sortedReferrals.map((r) => {
                    const s = r.status;
                    const name = r.referred?.full_name || r.referred?.username || "A founder";
                    const initial = (name[0] || "?").toUpperCase();
                    const tint =
                      s === "active"
                        ? { background: "rgba(34, 197, 94, 0.12)", color: "#4ade80" }
                        : s === "pending"
                          ? { background: "rgba(245, 158, 11, 0.12)", color: "#f8c56a" }
                          : { background: "rgba(255, 255, 255, 0.05)", color: "var(--text-muted)" };
                    return (
                      <div key={r.id} className={`flex items-center gap-3 ${ui.row}`} style={{ padding: "10px" }}>
                        <div
                          aria-hidden
                          className="flex items-center justify-center shrink-0"
                          style={{ width: 34, height: 34, borderRadius: "50%", fontSize: 13, ...tint }}
                        >
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate" style={{ fontSize: 14, color: "var(--text-primary)" }}>
                            {name}
                          </p>
                          <p style={MUTED}>
                            Joined {relativeDate(r.created_at)}
                            {s === "pending" ? " · hasn't activated yet" : ""}
                          </p>
                        </div>
                        <span className={`${ui.chip} shrink-0`} style={STATUS_CHIP[s] ?? {}}>
                          {STATUS_LABEL[s] ?? s}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Tile>
        </div>

        {/* RIGHT (sticky on desktop) */}
        <div className="min-w-0 space-y-4 lg:sticky" style={{ top: "calc(var(--topbar-h, 64px) + 16px)" }}>
          <Tile kicker="Milestones">
            <div className="space-y-1">
              {MILESTONES.map((m) => {
                const done = totalCount >= m.count;
                const isTarget = !done && nextMilestone?.count === m.count;
                return (
                  <div
                    key={m.count}
                    className="relative flex items-center justify-between gap-3"
                    style={{ padding: "8px 0 8px 12px" }}
                  >
                    <span
                      aria-hidden
                      className="absolute left-0 top-2 bottom-2 rounded"
                      style={{
                        width: 2,
                        background: done ? "#22c55e" : isTarget ? "#f59e0b" : "rgba(255, 255, 255, 0.08)",
                      }}
                    />
                    <div className="min-w-0">
                      <p style={{ fontSize: 14, color: done ? "#4ade80" : isTarget ? "#f8c56a" : "var(--text-secondary)" }}>
                        {m.count} {m.count === 1 ? "referral" : "referrals"}
                      </p>
                      <p style={{ ...MUTED, marginTop: 1 }}>{m.reward}</p>
                    </div>
                    <span className="shrink-0" style={{ fontSize: 13 }}>
                      {done ? (
                        <span style={{ color: "#4ade80" }}>✓ Earned</span>
                      ) : isTarget ? (
                        <span style={{ color: "#f8c56a" }}>
                          {totalCount} of {m.count}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </Tile>

          <Tile kicker="Your monthly bonus">
            <div className="flex items-baseline gap-2">
              {bonusIsFree ? (
                <span style={{ fontSize: 30, fontWeight: 600, color: "#4ade80" }}>Free</span>
              ) : (
                <>
                  <span style={{ fontSize: 30, fontWeight: 600, color: "#f8c56a" }}>${monthlyBonus}</span>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>off every month</span>
                </>
              )}
            </div>
            <p style={{ ...MUTED, marginTop: 4 }}>
              {activeCount} active {activeCount === 1 ? "referral" : "referrals"}
              {!bonusIsFree && monthlyBonus > 0 ? ` · you pay $${memberPrice - monthlyBonus}` : ""}
            </p>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
              {[...bonusLadder].reverse().map((t) => {
                const held = activeCount >= t.min;
                return (
                  <div key={t.min} className="flex justify-between items-center" style={{ padding: "5px 0", fontSize: 13 }}>
                    <span style={{ color: held ? "#f8c56a" : "var(--text-secondary)" }}>{t.min}+ active</span>
                    <span style={{ color: held ? "#f8c56a" : "var(--text-muted)" }}>
                      {t.amountOff === null ? "Free" : `$${t.amountOff} off a month`}
                    </span>
                  </div>
                );
              })}
            </div>

            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)", marginTop: 12 }}>
              Your bonus tracks how many of your referrals are{" "}
              <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>still active</strong>, and
              recalculates as people come and go. Fill a room of 12 and Quorum is free.
            </p>
          </Tile>
        </div>
      </div>
    </Shell>
  );
}
