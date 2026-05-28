"use client";

import Link from "next/link";
import PostCard, { type PostWithAuthor } from "@/components/PostCard";

export default function ProfilePostsList({ posts }: { posts: PostWithAuthor[] }) {
  if (!posts || posts.length === 0) {
    return <p className="font-mono lowercase text-xs text-text-faint">no posts yet.</p>;
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
