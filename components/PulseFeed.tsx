"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PostCard, { PostWithAuthor } from "@/components/PostCard";

const PAGE = 20;

export default function PulseFeed({ initial }: { initial: PostWithAuthor[] }) {
  const [posts, setPosts] = useState<PostWithAuthor[]>(initial);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(initial.length < PAGE);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("pulse:stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: "post_type=eq.pulse" },
        async (payload) => {
          const row = payload.new as PostWithAuthor & { author_id: string };
          const { data: author } = await supabase
            .from("profiles")
            .select("full_name, stage, username, created_at")
            .eq("id", row.author_id)
            .single();
          setPosts((prev) => [{ ...row, author }, ...prev]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
        "id, content, tag, is_anonymous, post_type, reply_count, created_at, author_id, local_hour",
      )
      .eq("post_type", "pulse")
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

    setPosts((prev) => [...prev, ...hydrated]);
    if (rows.length < PAGE) setDone(true);
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      {posts.length === 0 ? (
        <p className="font-mono lowercase text-xs text-text-faint">nothing on the pulse yet.</p>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} />)
      )}

      {!done && posts.length > 0 && (
        <div className="pt-2 flex justify-center">
          <button
            onClick={loadMore}
            disabled={busy}
            className="font-mono lowercase text-[0.7rem] px-4 py-2 border hover:border-amber transition-colors disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            {busy ? "loading…" : "load more →"}
          </button>
        </div>
      )}
    </div>
  );
}
