import Avatar from "@/components/Avatar";
import { TAG_COLOR, timeAgo } from "@/lib/stage";
import { is2amPost } from "@/lib/recognition";
import BookmarkButton from "@/components/BookmarkButton";
import PostMenu from "@/components/PostMenu";

export type PostWithAuthor = {
  id: string;
  content: string;
  tag: string | null;
  is_anonymous: boolean;
  post_type: string;
  reply_count: number;
  created_at: string;
  local_hour?: number | null;
  author?: {
    full_name: string | null;
    stage: string | null;
    username: string | null;
    created_at?: string | null;
  } | null;
  // Quiet flags hydrated by the page that loaded the post.
  movedTheRoom?: boolean;
  authorDepthRing?: boolean;
  authorAnniversary?: boolean;
};

export default function PostCard({ post }: { post: PostWithAuthor }) {
  const anon = post.is_anonymous;
  const tagColor = post.tag ? TAG_COLOR[post.tag] ?? "#707070" : "#707070";
  const lateNight = is2amPost(post);
  const moved = !!post.movedTheRoom;

  const isPulse = post.post_type === "pulse";
  const savedType: "pulse_post" | "cohort_post" = isPulse ? "pulse_post" : "cohort_post";

  return (
    <article
      className={`group relative p-4 border${moved ? " moved-room-pulse" : ""}`}
      style={{
        background: "var(--card-elev)",
        borderColor: "var(--border-amber)",
        borderLeft: anon ? "3px solid #3a3a3a" : `1px solid var(--border-amber)`,
        boxShadow: lateNight
          ? "0 0 22px 1px rgba(245, 158, 11, 0.10), 0 0 4px rgba(245, 158, 11, 0.06)"
          : undefined,
      }}
    >
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <BookmarkButton itemType={savedType} itemId={post.id} variant="inline" />
        {isPulse && <PostMenu postId={post.id} />}
      </div>
      <header className="flex items-center gap-3 mb-2">
        {anon ? (
          <div
            className="w-8 h-8 flex items-center justify-center font-mono text-[0.6rem] lowercase"
            style={{ background: "var(--card)", color: "var(--text-faint)", borderRadius: "50%" }}
          >
            ??
          </div>
        ) : (
          <Avatar
            name={post.author?.full_name}
            stage={post.author?.stage}
            username={post.author?.username}
            size={32}
            depthRing={!!post.authorDepthRing}
            anniversary={!!post.authorAnniversary}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-mono lowercase text-xs text-text-primary truncate">
            {anon ? <span className="text-text-faint">anonymous</span> : post.author?.full_name?.toLowerCase() ?? "—"}
          </p>
          <p className="font-mono lowercase text-[0.65rem] text-text-faint">
            {timeAgo(post.created_at)} ago
          </p>
        </div>
      </header>

      <p className="text-text-secondary text-[0.92rem] leading-relaxed whitespace-pre-wrap">
        {post.content}
      </p>

      <footer className="flex items-center justify-between mt-3">
        <span className="font-mono lowercase text-[0.65rem] text-text-faint">
          ↳ {post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}
        </span>
        {post.tag && (
          <span
            className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
            style={{
              border: `1px solid ${tagColor}`,
              color: tagColor,
              background: "transparent",
            }}
          >
            {post.tag}
          </span>
        )}
      </footer>
    </article>
  );
}
