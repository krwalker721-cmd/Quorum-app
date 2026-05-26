"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PostCard, { PostWithAuthor } from "@/components/PostCard";

export default function Feed({ initial }: { initial: PostWithAuthor[] }) {
  const [posts, setPosts] = useState<PostWithAuthor[]>(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("posts:stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const row = payload.new as PostWithAuthor & { author_id: string };
          // Hydrate author info
          const { data: author } = await supabase
            .from("profiles")
            .select("full_name, stage, username")
            .eq("id", row.author_id)
            .single();
          setPosts((prev) => [{ ...row, author }, ...prev]);
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
            cohort.map((p) => <PostCard key={p.id} post={p} />)
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
            pulse.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      </section>
    </div>
  );
}
