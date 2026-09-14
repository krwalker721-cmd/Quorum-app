"use client";

import PostCard, { type PostWithAuthor } from "@/components/PostCard";
import ui from "@/components/ui/sleek.module.css";

// Posts render as plain cards. They used to be wrapped in a <Link> to the feed,
// but PostCard's avatar is itself a link, and a link inside a link is invalid
// HTML that broke hydration. The card's Share action copies the post's link.
export default function ProfilePostsList({ posts }: { posts: PostWithAuthor[] }) {
  if (!posts || posts.length === 0) {
    return (
      <div className={ui.tile} style={{ padding: "20px 22px" }}>
        <div className={ui.empty}>
          <p className={ui.emptyTitle}>No posts yet.</p>
          <p className={ui.emptySub}>When they share something with the room, it shows up here.</p>
        </div>
      </div>
    );
  }
  return (
    <>
      {posts.map((p) => (
        <PostCard key={p.id} sleek post={p} />
      ))}
    </>
  );
}
