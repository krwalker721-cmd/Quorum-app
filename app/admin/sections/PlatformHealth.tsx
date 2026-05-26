"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../lib/api";
import { SectionShell } from "./Overview";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Health = {
  avgPostsPerUser: number;
  checkinCompletion: number;
  mostActiveCohort: string;
  vaultSavesWeek: number;
  collabActivity: { projects: number; votes: number };
  referralConversion: number;
  weeks: { week_start: string; signups: number; active: number; posts: number; checkins: number }[];
  tagPopularity: { tag: string; count: number }[];
};

export default function PlatformHealthSection() {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch("/api/admin/health");
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <SectionShell title="platform_health"><p className="font-mono text-xs text-text-faint">loading…</p></SectionShell>;
  if (!data) return <SectionShell title="platform_health"><p className="font-mono text-xs text-text-faint">failed to load</p></SectionShell>;

  return (
    <SectionShell title="platform_health">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <HCard label="avg_posts_per_user_this_week" value={data.avgPostsPerUser.toFixed(2)} />
        <HCard label="check_in_completion_rate" value={`${data.checkinCompletion}%`} />
        <HCard label="most_active_cohort" value={data.mostActiveCohort} mono />
        <HCard label="vault_saves_this_week" value={data.vaultSavesWeek} />
        <HCard
          label="collab_board_activity"
          value={`${data.collabActivity.projects} projects · ${data.collabActivity.votes} votes`}
          mono
        />
        <HCard label="referral_conversion_rate" value={`${data.referralConversion}%`} />
      </div>

      <p className="font-mono lowercase text-[0.7rem] text-text-faint mt-6 mb-2">retention · last 8 weeks</p>
      <div className="border overflow-x-auto" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <table className="w-full text-[0.78rem]">
          <thead>
            <tr className="font-mono lowercase text-[0.6rem] text-text-faint">
              <th className="text-left px-3 py-2">week_start</th>
              <th className="text-left px-3 py-2">signups</th>
              <th className="text-left px-3 py-2">active</th>
              <th className="text-left px-3 py-2">posts</th>
              <th className="text-left px-3 py-2">check_ins</th>
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((w, i) => {
              const prev = data.weeks[i - 1];
              return (
                <tr key={w.week_start} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 font-mono text-[0.7rem] text-text-muted">{w.week_start}</td>
                  <Cell value={w.signups} prev={prev?.signups} />
                  <Cell value={w.active} prev={prev?.active} />
                  <Cell value={w.posts} prev={prev?.posts} />
                  <Cell value={w.checkins} prev={prev?.checkins} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="font-mono lowercase text-[0.7rem] text-text-faint mt-6 mb-2">tag popularity · last 30d</p>
      <div className="border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        {data.tagPopularity.length === 0 ? (
          <p className="font-mono text-xs text-text-faint">no tagged posts yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.tagPopularity}>
              <CartesianGrid stroke="#21262d" strokeDasharray="3 3" />
              <XAxis dataKey="tag" stroke="#6e7681" tick={{ fontSize: 10, fontFamily: "monospace" }} />
              <YAxis stroke="#6e7681" tick={{ fontSize: 10, fontFamily: "monospace" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#161b22", border: "1px solid #21262d", fontSize: 10, fontFamily: "monospace" }} />
              <Bar dataKey="count" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionShell>
  );
}

function HCard({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <p className="font-mono text-[0.6rem] lowercase text-text-faint">{label}</p>
      <p className={`${mono ? "font-mono text-sm" : "font-mono text-2xl"} text-text-primary mt-1`}>{value}</p>
    </div>
  );
}

function Cell({ value, prev }: { value: number; prev?: number }) {
  let color = "var(--text-muted)";
  if (prev !== undefined) {
    if (value > prev) color = "#22c55e";
    else if (value < prev) color = "#ef4444";
    else color = "#f59e0b";
  }
  return (
    <td className="px-3 py-2 font-mono text-[0.78rem]" style={{ color }}>
      {value}
    </td>
  );
}
