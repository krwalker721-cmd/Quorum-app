"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../lib/api";
import { SectionShell } from "./Overview";

type Row = {
  user_id: string;
  username: string | null;
  full_name: string | null;
  tier: string;
  joined_at: string;
  referral_count: number;
  active_referral_count: number;
};

const TIER_COLORS: Record<string, string> = {
  free: "#484f58",
  member: "#f59e0b",
  partner: "#a78bfa",
};

export default function PartnerWaitlistSection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/partner-waitlist");
      if (res.ok) {
        const json = await res.json();
        setRows(json.waitlist ?? []);
        setTotal(json.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SectionShell title="partner_waitlist">
      <div className="flex items-center gap-4 mb-5">
        <div
          className="px-4 py-3 border"
          style={{ borderColor: "rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.06)" }}
        >
          <p className="font-mono lowercase text-[0.6rem]" style={{ color: "#a78bfa" }}>
            on the waitlist
          </p>
          <p className="font-mono text-2xl" style={{ color: "#a78bfa" }}>
            {total}
          </p>
        </div>
        <button
          onClick={load}
          className="font-mono lowercase text-[0.7rem] px-3 py-2 border self-start"
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
              <th className="text-left px-3 py-2">joined</th>
              <th className="text-left px-3 py-2">referrals</th>
              <th className="text-left px-3 py-2">active_referrals</th>
              <th className="text-left px-3 py-2">grant</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 font-mono text-xs text-text-faint">
                  loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 font-mono text-xs text-text-faint">
                  no one on the waitlist yet
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.user_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2">
                    <p className="text-text-secondary">{r.full_name ?? "—"}</p>
                    <p className="font-mono text-[0.6rem] text-text-faint lowercase">
                      {r.username ? `@${r.username}` : r.user_id.slice(0, 8)}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="font-mono text-[0.6rem] lowercase px-1.5 py-0.5"
                      style={{
                        background: `${TIER_COLORS[r.tier] ?? "#484f58"}22`,
                        color: TIER_COLORS[r.tier] ?? "#484f58",
                      }}
                    >
                      {r.tier}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.6rem] text-text-faint">
                    {r.joined_at?.slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.7rem] text-text-secondary">
                    {r.referral_count}
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.7rem]" style={{ color: "#22c55e" }}>
                    {r.active_referral_count}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      disabled
                      title="Partner tier coming soon"
                      className="font-mono lowercase text-[0.6rem] px-2 py-1 border opacity-50 cursor-not-allowed"
                      style={{ borderColor: "rgba(167,139,250,0.3)", color: "#a78bfa" }}
                    >
                      grant partner access
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
