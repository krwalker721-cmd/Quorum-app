"use client";

import Link from "next/link";
import PostCard, { type PostWithAuthor } from "@/components/PostCard";

export default function ProfilePostsList({ posts }: { posts: PostWithAuthor[] }) {
  if (!posts || posts.length === 0) {
    return (
      <div className="empty-panel compact">
        <p className="empty-panel-title">no posts yet.</p>
        <p className="empty-panel-sub">when they share something with the room, it shows up here.</p>
      </div>
    );
  }
  return (
    <>
      {posts.map((p) => (
        <Link
          key={p.id}
          href={`/${p.post_type === "pulse" ? "pulse" : "home"}#post-${p.id}`}
          className="block hover:opacity-90 transition-opacity"
        >
          <PostCard post={p} />
        </Link>
      ))}
    </>
  );
}
