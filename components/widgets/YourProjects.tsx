"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/stage";

type ProjectRow = {
  id: string;
  title: string;
  category: string | null;
  last_activity_at: string | null;
  has_unread: boolean;
};

const CATEGORY_COLOR: Record<string, string> = {
  growth: "#f59e0b",
  fundraising: "#38bdf8",
  hiring: "#6e7681",
  product: "#a78bfa",
  ops: "#6e7681",
};

const VISIT_KEY_PREFIX = "quorum:project_visited:";

export default function YourProjects({ userId }: { userId: string }) {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: memberRows } = await supabase
        .from("project_members")
        .select("project_id, projects!inner(id, title, name, category, status, post_type)")
        .eq("user_id", userId);

      const openProjects = ((memberRows ?? []) as any[])
        .map((r) => r.projects)
        .filter((p: any) => p && (p.status ?? "open") === "open" && (p.post_type ?? "project") === "project");

      if (cancelled) return;
      setTotalCount(openProjects.length);

      const ids = openProjects.map((p: any) => p.id);
      let lastByProject = new Map<string, string>();
      if (ids.length > 0) {
        const { data: msgs } = await supabase
          .from("project_messages")
          .select("project_id, created_at")
          .in("project_id", ids)
          .order("created_at", { ascending: false })
          .limit(200);
        for (const m of (msgs ?? []) as any[]) {
          if (!lastByProject.has(m.project_id)) lastByProject.set(m.project_id, m.created_at);
        }
      }

      const hydrated: ProjectRow[] = openProjects.map((p: any) => {
        const ts = lastByProject.get(p.id) ?? null;
        let unread = false;
        if (ts) {
          try {
            const stored = localStorage.getItem(VISIT_KEY_PREFIX + p.id);
            const last = stored ? new Date(stored).getTime() : 0;
            if (new Date(ts).getTime() > last) unread = true;
          } catch {}
        }
        return {
          id: p.id,
          title: (p.title ?? p.name ?? "untitled") as string,
          category: p.category as string | null,
          last_activity_at: ts,
          has_unread: unread,
        };
      });

      hydrated.sort((a, b) => {
        const at = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
        const bt = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
        return bt - at;
      });

      if (cancelled) return;
      setRows(hydrated.slice(0, 4));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function truncate(s: string, n: number) {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  return (
    <div
      className="side-widget"
      style={{ "--w-accent": "#58a6ff" } as React.CSSProperties}
    >
      <div className="side-widget-head">
        <span className="side-widget-glyph" aria-hidden>▣</span>
        <p className="side-widget-label">your_projects</p>
        {totalCount > 0 && <span className="side-widget-meta">{totalCount}</span>}
      </div>
      {loading ? (
        <p className="font-mono lowercase text-[0.7rem] text-text-faint">loading…</p>
      ) : rows.length === 0 ? (
        <div className="empty-panel compact">
          <p className="empty-panel-title">no active projects.</p>
          <p className="empty-panel-sub">find founders building things you care about.</p>
          <Link href="/collab" className="empty-panel-cta">
            open the collab board →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => {
            const color = p.category ? CATEGORY_COLOR[p.category] ?? "#6e7681" : "#6e7681";
            return (
              <Link
                key={p.id}
                href={`/collab/${p.id}`}
                onClick={() => {
                  try {
                    localStorage.setItem(VISIT_KEY_PREFIX + p.id, new Date().toISOString());
                  } catch {}
                }}
                className="flex items-center gap-2 p-2.5 border rounded-lg transition-colors"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono lowercase text-[0.72rem] text-text-primary truncate">
                      {truncate(p.title.toLowerCase(), 30)}
                    </span>
                    {p.has_unread && (
                      <span
                        aria-label="new activity"
                        className="rounded-full shrink-0"
                        style={{
                          width: 6,
                          height: 6,
                          background: "#f59e0b",
                          boxShadow: "0 0 4px rgba(245, 158, 11, 0.6)",
                        }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {p.category && (
                      <span
                        className="font-mono lowercase text-[0.55rem] px-1.5 py-0.5 rounded-full"
                        style={{ border: `1px solid ${color}`, color }}
                      >
                        {p.category}
                      </span>
                    )}
                    <span className="font-mono lowercase text-[0.55rem] text-text-faint">
                      {p.last_activity_at ? `active ${timeAgo(p.last_activity_at)} ago` : "no activity"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
          {totalCount > 4 && (
            <Link
              href="/collab"
              className="block text-right font-mono lowercase text-[0.65rem] mt-1 hover:underline"
              style={{ color: "#58a6ff" }}
            >
              view all {totalCount} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
