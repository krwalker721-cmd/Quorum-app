import Avatar from "@/components/Avatar";
import { TAG_COLOR, ROOM_TYPE_COLOR, timeAgo } from "@/lib/stage";
import { is2amPost } from "@/lib/recognition";
import BookmarkButton from "@/components/BookmarkButton";
import PostMenu from "@/components/PostMenu";

export type PostWithAuthor = {
  id: string;
  content: string;
  tag: string | null;
  room_type?: string | null;
  is_anonymous: boolean;
  post_type: string;
  reply_count: number;
  created_at: string;
  local_hour?: number | null;
  // Server-decorated: post has had a reply in the last 2 hours.
  isActive?: boolean;
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

  const roomType = post.room_type ?? null;
  const isDecision = roomType === "decision";
  const isBlocker = roomType === "blocker";
  const isWin = roomType === "win";
  const isQuestion = roomType === "question";
  const isActive = !!post.isActive;

  // Left-border treatment â€” chosen by type, then anonymity, then default.
  let leftBorder = `1px solid var(--border-amber)`;
  if (anon) {
    leftBorder = "2px solid #3a3a3a";
  } else if (isDecision || isBlocker) {
    leftBorder = "3px solid rgba(220, 100, 20, 0.75)";
  } else if (isWin) {
    leftBorder = "3px solid rgba(34, 197, 94, 0.75)";
  } else if (isQuestion) {
    leftBorder = "3px solid rgba(56, 189, 248, 0.75)";
  }
  // If active, the left border is overridden by the green pulse class.
  if (isActive && !anon) {
    leftBorder = "3px solid rgba(34, 197, 94, 0.6)";
  }

  const decisionBoost = isDecision ? "py-6" : "p-4";
  const winTint = isWin ? "rgba(34, 197, 94, 0.025)" : "var(--card-elev)";

  const borderColor = isDecision || isBlocker
    ? "rgba(220, 100, 20, 0.4)"
    : "var(--border-amber)";

  const classes = [
    "group relative border",
    isDecision ? "px-4 py-6" : "p-4",
    moved ? "moved-room-pulse" : "",
    isActive && !anon ? "pulse-active-breathe" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={classes}
      style={{
        background: winTint,
        borderColor,
        borderLeft: leftBorder,
        boxShadow: lateNight
          ? "0 0 22px 1px rgba(220, 100, 20, 0.10), 0 0 4px rgba(220, 100, 20, 0.06)"
          : undefined,
      }}
    >
      {/* Top-right indicators â€” always visible */}
      <div className="absolute top-2 right-2 flex items-center gap-2 pointer-events-none">
        {(isDecision || isBlocker) && (
          <span
            aria-hidden
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#dc6414", boxShadow: "0 0 6px rgba(220, 100, 20,0.7)" }}
          />
        )}
        {isActive && !anon && (
          <span
            className="font-mono lowercase tracking-wider"
            style={{ color: "#22c55e", fontSize: "8px" }}
          >
            active
          </span>
        )}
      </div>

      {/* Hover-only actions â€” sit to the left of indicators */}
      <div
        className="absolute top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ right: 56 }}
      >
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
            {anon ? <span className="text-text-faint">anonymous</span> : post.author?.full_name?.toLowerCase() ?? "â€”"}
          </p>
          <p className="font-mono lowercase text-[0.65rem] text-text-faint">
            {timeAgo(post.created_at)} ago
            {anon && <span className="ml-2" style={{ fontSize: "9px" }}>Â· posted anonymously</span>}
          </p>
        </div>
      </header>

      <p className="text-text-secondary text-[0.92rem] leading-relaxed whitespace-pre-wrap">
        {post.content}
      </p>

      <footer className="flex items-center justify-between mt-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono lowercase text-[0.65rem] text-text-faint">
            â†³ {post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}
          </span>
          {(isDecision || isBlocker) && (
            <span
              className="font-mono lowercase tracking-wider"
              style={{ color: "#dc6414", fontSize: "9px" }}
            >
              needs input
            </span>
          )}
          {isQuestion && (
            <span
              className="font-mono lowercase tracking-wider"
              style={{ color: "#38bdf8", fontSize: "9px" }}
            >
              needs input
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {roomType && (
            <span
              className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
              style={{
                border: `1px solid ${ROOM_TYPE_COLOR[roomType] ?? "#707070"}`,
                color: ROOM_TYPE_COLOR[roomType] ?? "#707070",
                background: "transparent",
              }}
            >
              {roomType}
            </span>
          )}
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
        </div>
      </footer>
    </article>
  );
}
