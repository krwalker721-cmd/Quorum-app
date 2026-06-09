"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PostCard, { PostWithAuthor } from "@/components/PostCard";

export default function Feed({
  initial,
  currentUserId,
}: {
  initial: PostWithAuthor[];
  currentUserId?: string;
}) {
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

  return (
    <div className="space-y-6">
      <section>
        <p className="widget-title font-mono lowercase mb-3">cohort_feed</p>
        <div className="space-y-3">
          {cohort.length === 0 ? (
            <div className="widget">
              <p className="empty-state font-mono lowercase">no posts in your cohort yet.</p>
            </div>
          ) : (
            cohort.map((p) => (
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
        </div>
      </section>

      <section>
        <p className="widget-title font-mono lowercase mb-3">pulse</p>
        <div className="space-y-3">
          {pulse.length === 0 ? (
            <div className="widget">
              <p className="empty-state font-mono lowercase">nothing on the pulse yet.</p>
            </div>
          ) : (
            pulse.map((p) => (
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
        </div>
      </section>
    </div>
  );
}
