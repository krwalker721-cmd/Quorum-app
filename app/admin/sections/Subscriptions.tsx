"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../lib/api";
import { SectionShell } from "./Overview";

type Row = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  tier: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  has_stripe_subscription: boolean;
};

const TIER_COLORS: Record<string, string> = {
  free: "#484f58",
  member: "#f59e0b",
  partner: "#a78bfa",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  trialing: "#58a6ff",
  past_due: "#f85149",
  canceled: "#484f58",
  incomplete: "#6e7681",
  paused: "#6e7681",
};

const TIERS = ["free", "member", "partner"] as const;
const STATUSES = ["trialing", "active", "past_due", "canceled"] as const;

export default function SubscriptionsSection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [nudged, setNudged] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/subscriptions");
      if (res.ok) {
        const json = await res.json();
        setRows(json.subscriptions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeTier(userId: string, tier: string) {
    setSavingId(userId);
    try {
      const res = await adminFetch("/api/admin/set-tier", {
        method: "POST",
        body: JSON.stringify({ id: userId, tier }),
      });
      if (res.ok) {
        setRows((prev) =>
          prev.map((r) => (r.user_id === userId ? { ...r, tier } : r)),
        );
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "failed");
      }
    } finally {
      setSavingId(null);
    }
  }

  async function sendNudge(userId: string) {
    setNudgingId(userId);
    try {
      const res = await adminFetch("/api/admin/nudge", {
        method: "POST",
        body: JSON.stringify({ id: userId }),
      });
      if (res.ok) {
        setNudged((prev) => new Set(prev).add(userId));
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "failed");
      }
    } finally {
      setNudgingId(null);
    }
  }

  const filtered = rows.filter((r) => {
    if (tierFilter !== "all" && r.tier !== tierFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (q) {
      const match = [r.username, r.full_name, r.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q.toLowerCase()));
      if (!match) return false;
    }
    return true;
  });

  return (
    <SectionShell title="subscriptions">
      <div className="flex items-center gap-2 mb-4">
        <input
          placeholder="search by name, email, username"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="md:max-w-sm"
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="font-mono text-[0.65rem] lowercase"
          style={{ width: "auto", padding: "4px 8px" }}
          title="filter by tier"
        >
          <option value="all">all tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="font-mono text-[0.65rem] lowercase"
          style={{ width: "auto", padding: "4px 8px" }}
          title="filter by status"
        >
          <option value="all">all statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          onClick={load}
          className="font-mono lowercase text-[0.7rem] px-3 py-2 border"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          refresh
        </button>
      </div>

      <div
        className="border overflow-x-auto"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <table className="w-full text-[0.78rem]">
          <thead>
            <tr className="font-mono lowercase text-[0.6rem] text-text-faint">
              <th className="text-left px-3 py-2">user</th>
              <th className="text-left px-3 py-2">tier</th>
              <th className="text-left px-3 py-2">status</th>
              <th className="text-left px-3 py-2">trial_ends</th>
              <th className="text-left px-3 py-2">period_end</th>
              <th className="text-left px-3 py-2">stripe_customer</th>
              <th className="text-left px-3 py-2">change_tier</th>
              <th className="text-left px-3 py-2">nudge</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 font-mono text-xs text-text-faint">
                  loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 font-mono text-xs text-text-faint">
                  no subscriptions
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.user_id}
                  className="border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-3 py-2">
                    <p className="text-text-secondary">{r.full_name ?? "—"}</p>
                    <p className="font-mono text-[0.6rem] text-text-faint lowercase">
                      {r.username ? `@${r.username}` : r.email ?? r.user_id.slice(0, 8)}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <Pill value={r.tier} color={TIER_COLORS[r.tier] ?? "#484f58"} />
                  </td>
                  <td className="px-3 py-2">
                    <Pill
                      value={r.cancel_at_period_end ? `${r.status} (cancelling)` : r.status}
                      color={STATUS_COLORS[r.status] ?? "#6e7681"}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.6rem] text-text-faint">
                    {r.trial_ends_at?.slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.6rem] text-text-faint">
                    {r.current_period_end?.slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.6rem] text-text-muted lowercase">
                    {r.stripe_customer_id ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={r.tier}
                      disabled={savingId === r.user_id}
                      onChange={(e) => changeTier(r.user_id, e.target.value)}
                      className="font-mono text-[0.65rem] lowercase disabled:opacity-50"
                      style={{ width: "auto", padding: "2px 6px" }}
                    >
                      {TIERS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => sendNudge(r.user_id)}
                      disabled={nudgingId === r.user_id || nudged.has(r.user_id)}
                      className="font-mono lowercase text-[0.6rem] px-2 py-1 border disabled:opacity-50"
                      style={{
                        borderColor: "var(--border)",
                        color: nudged.has(r.user_id) ? "#22c55e" : "#f59e0b",
                      }}
                      title="send an upgrade nudge notification"
                    >
                      {nudged.has(r.user_id)
                        ? "sent ✓"
                        : nudgingId === r.user_id
                          ? "…"
                          : "send nudge"}
                    </button>
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
