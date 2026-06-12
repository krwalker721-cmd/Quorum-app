"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PostCard, { PostWithAuthor } from "@/components/PostCard";
import PulseEmptyState from "@/components/pulse/PulseEmptyState";

const PAGE = 20;

function priority(p: PostWithAuthor, peerIds: Set<string>): number {
  if ((p.room_type === "decision" || p.room_type === "blocker") && p.isActive) return 1;
  if (p.author && (p as any).author_id && peerIds.has((p as any).author_id)) return 2;
  // also handle case where author_id sits on the row itself
  const aid = (p as any).author_id;
  if (aid && peerIds.has(aid)) return 2;
  return 3;
}

function sortSmart(posts: PostWithAuthor[], peerIds: Set<string>) {
  return [...posts].sort((a, b) => {
    const pa = priority(a, peerIds);
    const pb = priority(b, peerIds);
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export default function PulseFeed({
  initial,
  cohortPeerIds,
  currentUserId,
}: {
  initial: PostWithAuthor[];
  cohortPeerIds: string[];
  currentUserId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const tagFilter = params.get("tag");

  const peerIds = useMemo(() => new Set(cohortPeerIds), [cohortPeerIds]);
  const [posts, setPosts] = useState<PostWithAuthor[]>(() => sortSmart(initial, peerIds));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(initial.length < PAGE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Only one post can be expanded at a time.
  const onToggleReplies = (id: string) =>
    setExpandedId((cur) => (cur === id ? null : id));

  const filtered = useMemo(() => {
    if (!tagFilter) return posts;
    return posts.filter((p) => p.room_type === tagFilter || p.tag === tagFilter);
  }, [posts, tagFilter]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("pulse:stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: "post_type=eq.pulse" },
        async (payload) => {
          const row = payload.new as PostWithAuthor & {
            author_id: string;
            parent_post_id?: string | null;
          };
          // A reply (parent_post_id set) bumps the parent's count + marks active
          // rather than appearing as its own pulse card.
          if (row.parent_post_id) {
            setPosts((prev) =>
              sortSmart(
                prev.map((p) =>
                  p.id === row.parent_post_id
                    ? { ...p, reply_count: (p.reply_count ?? 0) + 1, isActive: true }
                    : p,
                ),
                peerIds,
              ),
            );
            return;
          }
          const { data: author } = await supabase
            .from("profiles")
            .select("full_name, stage, username, created_at")
            .eq("id", row.author_id)
            .single();
          setPosts((prev) =>
            prev.find((p) => p.id === row.id)
              ? prev
              : sortSmart([{ ...row, author }, ...prev], peerIds),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [peerIds, currentUserId]);

  async function loadMore() {
    if (busy || done) return;
    setBusy(true);
    const supabase = createClient();
    const oldest = posts[posts.length - 1]?.created_at;
    if (!oldest) {
      setBusy(false);
      return;
    }
    const { data: rows } = await supabase
      .from("posts")
      .select(
        "id, content, tag, room_type, is_anonymous, post_type, cohort_id, reply_count, created_at, author_id, local_hour",
      )
      .eq("post_type", "pulse")
      .is("parent_post_id", null)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(PAGE);

    if (!rows || rows.length === 0) {
      setDone(true);
      setBusy(false);
      return;
    }

    const ids = Array.from(new Set(rows.map((r) => r.author_id).filter(Boolean) as string[]));
    const { data: authors } = await supabase
      .from("profiles")
      .select("id, full_name, stage, username, created_at")
      .in("id", ids);
    const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));

    const hydrated: PostWithAuthor[] = rows.map((p: any) => ({
      ...p,
      author: authorMap.get(p.author_id) ?? null,
    }));

    setPosts((prev) => sortSmart([...prev, ...hydrated], peerIds));
    if (rows.length < PAGE) setDone(true);
    setBusy(false);
  }

  function clearFilter() {
    router.push("/pulse");
  }

  if (posts.length === 0) {
    return <PulseEmptyState userId={currentUserId} />;
  }

  return (
    <div className="space-y-4 pulse-feed-container">
      {tagFilter && (
        <div
          className="flex items-center justify-between px-4 py-3 border rounded-xl"
          style={{ background: "var(--card-elev)", borderColor: "var(--border-amber)", maxWidth: 680 }}
        >
          <p className="font-mono lowercase text-[0.7rem] text-text-muted">
            filtered by{" "}
            <span style={{ color: "#f59e0b" }}>#{tagFilter}</span>
          </p>
          <button
            onClick={clearFilter}
            className="font-mono lowercase text-[0.65rem] px-2.5 py-1 border rounded-lg hover:border-amber transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            clear filter
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-panel" style={{ maxWidth: 680 }}>
          <span className="empty-panel-glyph" aria-hidden>#</span>
          <p className="empty-panel-title">nothing here yet for #{tagFilter}.</p>
          <p className="empty-panel-sub">try clearing the filter to see the whole room.</p>
          <button onClick={clearFilter} className="empty-panel-cta">
            clear filter →
          </button>
        </div>
      ) : (
        filtered.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            currentUserId={currentUserId}
            onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))}
            expanded={expandedId === p.id}
            onToggleReplies={onToggleReplies}
          />
        ))
      )}

      {!done && filtered.length > 0 && !tagFilter && (
        <div className="pt-2 flex justify-center">
          <button
            onClick={loadMore}
            disabled={busy}
            className="font-mono lowercase text-[0.7rem] px-4 py-2 border rounded-lg hover:border-amber transition-colors disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            {busy ? "loading…" : "load more "}
          </button>
        </div>
      )}
    </div>
  );
}
