"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../lib/api";
import { SectionShell } from "./Overview";

type Totals = {
  total: number;
  active: number;
  pending: number;
  inactive: number;
  churned: number;
};

type Person = { username: string | null; full_name: string | null } | null;

type TopReferrer = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  total_referrals: number;
  active_referrals: number;
  rewards_granted: number;
};

type Record_ = {
  id: string;
  status: string;
  created_at: string;
  activated_at: string | null;
  last_seen_at: string | null;
  referrer: Person;
  referrer_id: string;
  referred: Person;
  referred_id: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#58a6ff",
  active: "#22c55e",
  inactive: "#f59e0b",
  churned: "#484f58",
};

const MILESTONES = [
  "milestone_1",
  "milestone_3",
  "milestone_5",
  "milestone_10",
  "milestone_25",
] as const;

function nameOf(p: Person, fallbackId: string): string {
  return p?.full_name || p?.username || fallbackId.slice(0, 8);
}

export default function ReferralsSection() {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([]);
  const [records, setRecords] = useState<Record_[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantingId, setGrantingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/referrals");
      if (res.ok) {
        const json = await res.json();
        setTotals(json.totals ?? null);
        setTopReferrers(json.topReferrers ?? []);
        setRecords(json.records ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function grant(userId: string, rewardType: string) {
    setGrantingId(userId);
    try {
      const res = await adminFetch("/api/admin/referrals", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, reward_type: rewardType }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) alert(j.error ?? "failed");
      else if (j.ok === false) alert(j.reason ?? "not applied");
      else await load();
    } finally {
      setGrantingId(null);
    }
  }

  return (
    <SectionShell title="referrals">
      {/* Platform totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="total" value={totals?.total ?? 0} color="#e6edf3" />
        <Stat label="active" value={totals?.active ?? 0} color="#22c55e" />
        <Stat label="pending" value={totals?.pending ?? 0} color="#58a6ff" />
        <Stat label="inactive" value={totals?.inactive ?? 0} color="#f59e0b" />
        <Stat label="churned" value={totals?.churned ?? 0} color="#484f58" />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono lowercase text-[0.7rem] text-text-muted">top referrers</h3>
        <button
          onClick={load}
          className="font-mono lowercase text-[0.7rem] px-3 py-1.5 border"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          refresh
        </button>
      </div>

      {/* Top referrers + manual reward grant */}
      <div
        className="border overflow-x-auto mb-8"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <table className="w-full text-[0.78rem]">
          <thead>
            <tr className="font-mono lowercase text-[0.6rem] text-text-faint">
              <th className="text-left px-3 py-2">user</th>
              <th className="text-left px-3 py-2">total</th>
              <th className="text-left px-3 py-2">active</th>
              <th className="text-left px-3 py-2">rewards</th>
              <th className="text-left px-3 py-2">grant_reward</th>
            </tr>
          </thead>
          <tbody>
            {loading && topReferrers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 font-mono text-xs text-text-faint">
                  loading…
                </td>
              </tr>
            ) : topReferrers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 font-mono text-xs text-text-faint">
                  no referrers yet
                </td>
              </tr>
            ) : (
              topReferrers.map((r) => (
                <tr key={r.user_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2">
                    <p className="text-text-secondary">{r.full_name ?? "—"}</p>
                    <p className="font-mono text-[0.6rem] text-text-faint lowercase">
                      {r.username ? `@${r.username}` : r.user_id.slice(0, 8)}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{r.total_referrals}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.active_referrals}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.rewards_granted}</td>
                  <td className="px-3 py-2">
                    <select
                      defaultValue=""
                      disabled={grantingId === r.user_id}
                      onChange={(e) => {
                        if (e.target.value) grant(r.user_id, e.target.value);
                        e.target.value = "";
                      }}
                      className="font-mono text-[0.65rem] lowercase disabled:opacity-50"
                      style={{ width: "auto", padding: "2px 6px" }}
                    >
                      <option value="">grant…</option>
                      {MILESTONES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recent referral records */}
      <h3 className="font-mono lowercase text-[0.7rem] text-text-muted mb-3">
        recent referrals
      </h3>
      <div
        className="border overflow-x-auto"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <table className="w-full text-[0.78rem]">
          <thead>
            <tr className="font-mono lowercase text-[0.6rem] text-text-faint">
              <th className="text-left px-3 py-2">referrer</th>
              <th className="text-left px-3 py-2">referred</th>
              <th className="text-left px-3 py-2">status</th>
              <th className="text-left px-3 py-2">created</th>
              <th className="text-left px-3 py-2">last_seen</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 font-mono text-xs text-text-faint">
                  {loading ? "loading…" : "no referrals"}
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 text-text-secondary">
                    {nameOf(r.referrer, r.referrer_id)}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {nameOf(r.referred, r.referred_id)}
                  </td>
                  <td className="px-3 py-2">
                    <Pill value={r.status} color={STATUS_COLORS[r.status] ?? "#6e7681"} />
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.6rem] text-text-faint">
                    {r.created_at?.slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.6rem] text-text-faint">
                    {r.last_seen_at?.slice(0, 10) ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </SectionShell>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <p className="font-mono lowercase text-[0.6rem] text-text-faint">{label}</p>
      <p className="text-xl mt-1" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function Pill({ value, color }: { value: string; color: string }) {
  return (
    <span
      className="font-mono text-[0.6rem] lowercase px-1.5 py-0.5"
      style={{ background: `${color}22`, color }}
    >
      {value}
    </span>
  );
}
