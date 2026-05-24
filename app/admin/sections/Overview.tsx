"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type Overview = {
  totalUsers: number;
  pendingApproval: number;
  activeThisWeek: number;
  postsThisWeek: number;
  newSignupsThisWeek: number;
  tierCounts: { free: number; tier_1: number; tier_2: number };
  signupsSeries: { date: string; count: number }[];
  postsSeries: { date: string; count: number }[];
  checkinsSeries: { date: string; count: number }[];
  events: { type: string; at: string; label: string }[];
};

export default function OverviewSection() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await adminFetch("/api/admin/overview");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  if (loading && !data) {
    return <SectionShell title="overview"><Skeleton /></SectionShell>;
  }
  if (!data) {
    return <SectionShell title="overview"><p className="text-text-faint">failed to load</p></SectionShell>;
  }

  const activity = data.postsSeries.map((p, i) => ({
    date: p.date.slice(5),
    posts: p.count,
    checkins: data.checkinsSeries[i]?.count ?? 0,
  }));
  const signups = data.signupsSeries.map((s) => ({ date: s.date.slice(5), count: s.count }));

  return (
    <SectionShell title="overview">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric label="total_users" value={data.totalUsers} />
        <Metric
          label="pending_approval"
          value={data.pendingApproval}
          amber={data.pendingApproval > 0}
        />
        <Metric label="active_this_week" value={data.activeThisWeek} />
        <Metric label="posts_this_week" value={data.postsThisWeek} />
        <Metric label="new_signups_this_week" value={data.newSignupsThisWeek} />
        <TierMetric counts={data.tierCounts} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
        <ChartCard title="signups Â· last 30d">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={signups}>
              <CartesianGrid stroke="#2e2e2e" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#707070" tick={{ fontSize: 10, fontFamily: "monospace" }} />
              <YAxis stroke="#707070" tick={{ fontSize: 10, fontFamily: "monospace" }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="count" stroke="#dc6414" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="activity Â· last 30d">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={activity}>
              <CartesianGrid stroke="#2e2e2e" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#707070" tick={{ fontSize: 10, fontFamily: "monospace" }} />
              <YAxis stroke="#707070" tick={{ fontSize: 10, fontFamily: "monospace" }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "monospace" }} />
              <Line type="monotone" dataKey="posts" stroke="#dc6414" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="checkins" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-4 border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="font-mono lowercase text-[0.7rem] text-text-faint">recent activity</p>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {data.events.length === 0 ? (
            <p className="font-mono lowercase text-xs text-text-faint p-4">no events yet</p>
          ) : (
            data.events.map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 text-[0.78rem]"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="font-mono text-[0.6rem] text-text-faint w-28 shrink-0">
                  {timeAgo(e.at)}
                </span>
                <EventPill type={e.type} />
                <span className="text-text-secondary truncate">{e.label}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </SectionShell>
  );
}

export function SectionShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6 md:p-8">
      <p className="font-mono lowercase text-[0.7rem] text-text-faint">admin /</p>
      <h1 className="font-mono lowercase text-text-primary text-xl mt-1 mb-6">{title}</h1>
      {children}
    </div>
  );
}

function Metric({ label, value, amber }: { label: string; value: number; amber?: boolean }) {
  return (
    <div
      className="border p-3"
      style={{
        borderColor: amber ? "rgba(220, 100, 20,0.4)" : "var(--border)",
        background: "var(--card)",
      }}
    >
      <p className="font-mono lowercase text-[0.6rem] text-text-faint">{label}</p>
      <p
        className="font-mono text-2xl mt-1"
        style={{ color: amber ? "#dc6414" : "var(--text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}

function TierMetric({ counts }: { counts: { free: number; tier_1: number; tier_2: number } }) {
  return (
    <div className="border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <p className="font-mono lowercase text-[0.6rem] text-text-faint">tier_breakdown</p>
      <div className="flex items-end gap-3 mt-1">
        <div>
          <p className="font-mono text-lg text-text-primary">{counts.free}</p>
          <p className="font-mono text-[0.55rem] text-text-faint lowercase">free</p>
        </div>
        <div>
          <p className="font-mono text-lg text-text-primary">{counts.tier_1}</p>
          <p className="font-mono text-[0.55rem] text-text-faint lowercase">t1</p>
        </div>
        <div>
          <p className="font-mono text-lg text-text-primary">{counts.tier_2}</p>
          <p className="font-mono text-[0.55rem] text-text-faint lowercase">t2</p>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-3">{title}</p>
      {children}
    </div>
  );
}

function EventPill({ type }: { type: string }) {
  const colors: Record<string, string> = {
    signup: "#22c55e",
    post: "#dc6414",
    nomination: "#a78bfa",
    handshake: "#38bdf8",
  };
  return (
    <span
      className="font-mono text-[0.6rem] lowercase px-1.5 py-0.5 w-24 text-center shrink-0"
      style={{ background: "rgba(255,255,255,0.04)", color: colors[type] ?? "#c0c0c0" }}
    >
      {type}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 border" style={{ borderColor: "var(--border)", background: "var(--card)" }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-56 border" style={{ borderColor: "var(--border)", background: "var(--card)" }} />
        <div className="h-56 border" style={{ borderColor: "var(--border)", background: "var(--card)" }} />
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "#0c0c0c",
  border: "1px solid #2e2e2e",
  fontSize: 10,
  fontFamily: "monospace",
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
