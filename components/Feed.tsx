"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PostCard, { PostWithAuthor } from "@/components/PostCard";

export default function Feed({
  initial,
  currentUserId,
  cap,
}: {
  initial: PostWithAuthor[];
  currentUserId?: string;
  // When set, each section shows at most `cap` posts with a "more" link to the
  // full feed (used on the home dashboard to keep it skimmable).
  cap?: number;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<PostWithAuthor[]>(initial);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const onDeleted = (id: string) =>
    setPosts((prev) => prev.filter((p) => p.id !== id));
  // Only one post can be expanded at a time.
  const onToggleReplies = (id: string) =>
    setExpandedId((cur) => (cur === id ? null : id));

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("posts:stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const row = payload.new as PostWithAuthor & {
            author_id: string;
            parent_post_id?: string | null;
          };
          // Replies (parent_post_id set) bump the parent's count instead of
          // appearing as their own top-level card.
          if (row.parent_post_id) {
            setPosts((prev) =>
              prev.map((p) =>
                p.id === row.parent_post_id
                  ? { ...p, reply_count: (p.reply_count ?? 0) + 1 }
                  : p,
              ),
            );
            return;
          }
          // Hydrate author info
          const { data: author } = await supabase
            .from("profiles")
            .select("full_name, stage, username")
            .eq("id", row.author_id)
            .single();
          setPosts((prev) =>
            prev.find((p) => p.id === row.id) ? prev : [{ ...row, author }, ...prev],
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const cohort = posts.filter((p) => p.post_type === "cohort");
  const pulse = posts.filter((p) => p.post_type === "pulse");

  const cohortShown = typeof cap === "number" ? cohort.slice(0, cap) : cohort;
  const pulseShown = typeof cap === "number" ? pulse.slice(0, cap) : pulse;
  const cohortMore = cohort.length - cohortShown.length;
  const pulseMore = pulse.length - pulseShown.length;

  const moreLinkStyle: React.CSSProperties = {
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 11,
    color: "#484f58",
    letterSpacing: "0.06em",
    cursor: "pointer",
    padding: "12px 0",
    textAlign: "center",
    borderTop: "1px solid #21262d",
    marginTop: 8,
  };

  return (
    <div className="space-y-8">
      <section>
        <p className="widget-title font-mono lowercase">cohort_feed</p>
        <div className="space-y-4">
          {cohort.length === 0 ? (
            <div className="empty-panel">
              <p className="empty-panel-title">your cohort is quiet right now.</p>
              <p className="empty-panel-sub">
                the first post sets the tone — share the decision you&apos;re actually wrestling with.
              </p>
            </div>
          ) : (
            cohortShown.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                currentUserId={currentUserId}
                onDeleted={onDeleted}
                expanded={expandedId === p.id}
                onToggleReplies={onToggleReplies}
              />
            ))
          )}
          {cohortMore > 0 && (
            <div
              onClick={() => router.push("/cohort")}
              style={moreLinkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#8b949e")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#484f58")}
            >
              {cohortMore} more {cohortMore === 1 ? "post" : "posts"} in your cohort →
            </div>
          )}
        </div>
      </section>

      <section>
        <p className="widget-title font-mono lowercase">pulse</p>
        <div className="space-y-4">
          {pulse.length === 0 ? (
            <div className="empty-panel">
              <span className="empty-panel-glyph" aria-hidden>◌</span>
              <p className="empty-panel-title">nothing on the pulse yet.</p>
              <p className="empty-panel-sub">
                when founders across quorum post wins, blockers, and questions, they land here.
              </p>
            </div>
          ) : (
            pulseShown.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                currentUserId={currentUserId}
                onDeleted={onDeleted}
                expanded={expandedId === p.id}
                onToggleReplies={onToggleReplies}
              />
            ))
          )}
          {pulseMore > 0 && (
            <div
              onClick={() => router.push("/pulse")}
              style={moreLinkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#8b949e")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#484f58")}
            >
              {pulseMore} more {pulseMore === 1 ? "post" : "posts"} in the pulse feed →
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
