"use client";

import { useEffect, useState, useCallback } from "react";
import { adminFetch } from "../lib/api";
import { SectionShell } from "./Overview";

type Report = {
  id: string;
  reason: string;
  note: string | null;
  created_at: string;
  post: any | null;
  post_author: any | null;
  reporter: any | null;
};

type Post = {
  id: string;
  content: string;
  tag: string | null;
  post_type: string;
  reply_count: number;
  is_anonymous: boolean;
  created_at: string;
  author: { full_name: string | null; username: string | null } | null;
};

export default function ContentSection({
  onReportCountChange,
}: {
  onReportCountChange?: (n: number) => void;
}) {
  const [tab, setTab] = useState<"reported_posts" | "all_posts">("reported_posts");
  return (
    <SectionShell title="content">
      <div className="flex gap-1 mb-4">
        {(["reported_posts", "all_posts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`font-mono lowercase text-[0.7rem] px-3 py-2 border ${
              tab === t ? "text-text-primary" : "text-text-muted"
            }`}
            style={{
              borderColor: tab === t ? "#f59e0b" : "var(--border)",
              background: tab === t ? "rgba(245, 158, 11,0.06)" : "transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "reported_posts" ? (
        <ReportedPosts onCount={onReportCountChange} />
      ) : (
        <AllPosts />
      )}
    </SectionShell>
  );
}

function ReportedPosts({ onCount }: { onCount?: (n: number) => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/content/reports");
      if (res.ok) {
        const json = await res.json();
        setReports(json.reports ?? []);
        onCount?.(json.reports?.length ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [onCount]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "dismiss" | "remove") {
    const res = await adminFetch("/api/admin/content/reports", {
      method: "POST",
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) load();
  }

  if (loading) return <p className="font-mono text-xs text-text-faint">loading…</p>;
  if (reports.length === 0) {
    return <p className="font-mono text-xs text-text-faint">no pending reports</p>;
  }
  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div
          key={r.id}
          className="border p-4"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[0.6rem] lowercase px-1.5 py-0.5" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
              {r.reason}
            </span>
            <span className="font-mono text-[0.6rem] text-text-faint">
              reported by {r.reporter?.full_name?.toLowerCase() ?? r.reporter?.username ?? "—"} ·{" "}
              {timeAgo(r.created_at)}
            </span>
          </div>
          <p className="font-mono text-[0.6rem] text-text-faint mb-2">
            original post · {r.post_author?.full_name?.toLowerCase() ?? "—"}
            {r.post?.tag ? ` · ${r.post.tag}` : ""}
          </p>
          <p className="text-text-secondary text-sm whitespace-pre-wrap mb-3">
            {r.post?.content ?? "(post deleted)"}
          </p>
          {r.note && (
            <p className="text-text-muted text-[0.85rem] italic mb-3">"{r.note}"</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => act(r.id, "dismiss")}
              className="font-mono text-[0.65rem] lowercase px-3 py-1.5 border"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              dismiss
            </button>
            <button
              onClick={() => act(r.id, "remove")}
              className="font-mono text-[0.65rem] lowercase px-3 py-1.5"
              style={{ background: "#ef4444", color: "#000" }}
            >
              remove post
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AllPosts() {
  const [q, setQ] = useState("");
  const [postType, setPostType] = useState("");
  const [tag, setTag] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (postType) params.set("post_type", postType);
    if (tag) params.set("tag", tag);
    try {
      const res = await adminFetch(`/api/admin/content/posts?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setPosts(json.posts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [q, postType, tag]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("remove this post?")) return;
    const res = await adminFetch("/api/admin/content/posts", {
      method: "DELETE",
      body: JSON.stringify({ id, notify: true }),
    });
    if (res.ok) load();
  }

  const [nominated, setNominated] = useState<Record<string, boolean>>({});

  async function nominate(id: string) {
    const res = await adminFetch("/api/admin/vault-nomination", {
      method: "POST",
      body: JSON.stringify({ action: "create", post_id: id }),
    });
    if (res.ok) setNominated((m) => ({ ...m, [id]: true }));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          placeholder="search content"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          className="md:max-w-sm"
        />
        <select value={postType} onChange={(e) => setPostType(e.target.value)} style={{ width: "auto" }}>
          <option value="">all types</option>
          <option value="cohort">cohort</option>
          <option value="pulse">pulse</option>
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)} style={{ width: "auto" }}>
          <option value="">all tags</option>
          {["decision", "mindset", "hiring", "real_talk", "growth", "ops", "fundraising"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          onClick={load}
          className="font-mono lowercase text-[0.7rem] px-3 py-2 border"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          apply
        </button>
      </div>
      {loading && posts.length === 0 ? (
        <p className="font-mono text-xs text-text-faint">loading…</p>
      ) : posts.length === 0 ? (
        <p className="font-mono text-xs text-text-faint">no posts</p>
      ) : (
        <div className="border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <table className="w-full text-[0.78rem]">
            <thead>
              <tr className="font-mono lowercase text-[0.6rem] text-text-faint">
                <th className="text-left px-3 py-2">author</th>
                <th className="text-left px-3 py-2">content</th>
                <th className="text-left px-3 py-2">type</th>
                <th className="text-left px-3 py-2">tag</th>
                <th className="text-left px-3 py-2">replies</th>
                <th className="text-left px-3 py-2">created</th>
                <th className="text-left px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 text-text-secondary">
                    {p.is_anonymous ? "anonymous" : p.author?.full_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-text-muted max-w-md truncate">{p.content}</td>
                  <td className="px-3 py-2 font-mono text-[0.6rem] text-text-muted lowercase">{p.post_type}</td>
                  <td className="px-3 py-2 font-mono text-[0.6rem] text-text-muted lowercase">{p.tag ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[0.7rem] text-text-faint">{p.reply_count}</td>
                  <td className="px-3 py-2 font-mono text-[0.6rem] text-text-faint">{p.created_at.slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => nominate(p.id)}
                        disabled={nominated[p.id]}
                        className="font-mono text-[0.6rem] lowercase px-2 py-1 border disabled:opacity-50"
                        style={{ borderColor: "rgba(245, 158, 11, 0.55)", color: "#f59e0b" }}
                      >
                        {nominated[p.id] ? "nominated" : "nominate"}
                      </button>
                      <button
                        onClick={() => remove(p.id)}
                        className="font-mono text-[0.6rem] lowercase px-2 py-1 border"
                        style={{ borderColor: "var(--border)", color: "#ef4444" }}
                      >
                        remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
