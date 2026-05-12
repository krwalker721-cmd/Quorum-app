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
    <div className="space-y-8">
      <section>
        <p className="font-mono lowercase text-[0.7rem] text-text-faint mb-3 tracking-wider">
          cohort_feed
        </p>
        <div className="space-y-3">
          {cohort.length === 0 ? (
            <p className="font-mono lowercase text-xs text-text-faint">no posts in your cohort yet.</p>
          ) : (
            cohort.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      </section>

      <div className="border-t" style={{ borderColor: "var(--border)" }} />

      <section>
        <p className="font-mono lowercase text-[0.7rem] text-text-faint mb-3 tracking-wider">pulse</p>
        <div className="space-y-3">
          {pulse.length === 0 ? (
            <p className="font-mono lowercase text-xs text-text-faint">nothing on the pulse yet.</p>
          ) : (
            pulse.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      </section>
    </div>
  );
}
