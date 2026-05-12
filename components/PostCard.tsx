import Avatar from "@/components/Avatar";
import { TAG_COLOR, timeAgo } from "@/lib/stage";

export type PostWithAuthor = {
  id: string;
  content: string;
  tag: string | null;
  is_anonymous: boolean;
  post_type: string;
  reply_count: number;
  created_at: string;
  author?: { full_name: string | null; stage: string | null; username: string | null } | null;
};

export default function PostCard({ post }: { post: PostWithAuthor }) {
  const anon = post.is_anonymous;
  const tagColor = post.tag ? TAG_COLOR[post.tag] ?? "#707070" : "#707070";

  return (
    <article
      className="p-4 border"
      style={{
        background: "var(--card-elev)",
        borderColor: "var(--border-amber)",
        borderLeft: anon ? "3px solid #3a3a3a" : `1px solid var(--border-amber)`,
      }}
    >
      <header className="flex items-center gap-3 mb-2">
        {anon ? (
          <div
            className="w-8 h-8 flex items-center justify-center font-mono text-[0.6rem] lowercase"
            style={{ background: "var(--card)", color: "var(--text-faint)", borderRadius: "50%" }}
          >
            ??
          </div>
        ) : (
          <Avatar name={post.author?.full_name} stage={post.author?.stage} username={post.author?.username} size={32} />
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
