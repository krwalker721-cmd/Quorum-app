"use client";

import { useState, type CSSProperties } from "react";
import Avatar from "@/components/Avatar";
import { TAG_COLOR, ROOM_TYPE_COLOR, timeAgo } from "@/lib/stage";
import { is2amPost } from "@/lib/recognition";
import { usePresence } from "@/components/PresenceProvider";
import BookmarkButton from "@/components/BookmarkButton";
import PostMenu from "@/components/PostMenu";
import ReplyThread from "@/components/ReplyThread";

export type PostWithAuthor = {
  id: string;
  author_id?: string | null;
  content: string;
  tag: string | null;
  room_type?: string | null;
  is_anonymous: boolean;
  post_type: string;
  cohort_id?: string | null;
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

export default function PostCard({
  post,
  currentUserId,
  onDeleted,
  expanded = false,
  onToggleReplies,
}: {
  post: PostWithAuthor;
  currentUserId?: string | null;
  onDeleted?: (postId: string) => void;
  // When provided, the reply count + "reply →" become controls that expand the
  // thread inline. Omit (e.g. profile listing) to render an inert reply count.
  expanded?: boolean;
  onToggleReplies?: (postId: string) => void;
}) {
  const anon = post.is_anonymous;
  const tagColor = post.tag ? TAG_COLOR[post.tag] ?? "#6e7681" : "#6e7681";
  const lateNight = is2amPost(post);
  const moved = !!post.movedTheRoom;

  const online = usePresence();
  const isOnline = !anon && !!post.author_id && online.has(post.author_id);
  // Chat-style alignment: your own posts hug the right, everyone else's the
  // left. Computed per-viewer, so an anonymous post only sits right for its
  // own author and stays left for everyone else.
  const isMine = !!post.author_id && post.author_id === currentUserId;
  const [shared, setShared] = useState(false);

  const repliesOpen = !!onToggleReplies && expanded;

  async function handleShare() {
    try {
      const url = `${window.location.origin}/pulse#post-${post.id}`;
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      // clipboard unavailable — no-op
    }
  }

  const isPulse = post.post_type === "pulse";
  const savedType: "pulse_post" | "cohort_post" = isPulse ? "pulse_post" : "cohort_post";

  const roomType = post.room_type ?? null;
  const isDecision = roomType === "decision";
  const isBlocker = roomType === "blocker";
  const isWin = roomType === "win";
  const isQuestion = roomType === "question";
  const isActive = !!post.isActive;

  // Permanent type-based left accent. It is chosen purely by post type/tag
  // (anonymous posts get the neutral accent) and must NEVER fade, animate, or
  // change on hover — it is the post's permanent identity stripe.
  const accentKey = anon ? "anonymous" : (post.tag || roomType || post.post_type);
  const ACCENT: Record<string, string> = {
    decision: "#f59e0b",
    win: "#22c55e",
    blocker: "#f85149",
    question: "#58a6ff",
    update: "#30363d",
    anonymous: "#30363d",
    mindset: "#22c55e",
    real_talk: "#f85149",
  };
  const accentColor = ACCENT[accentKey ?? ""] ?? "#30363d";

  // Subtle background tint bleeding inward from the accent edge.
  const BG_TINT: Record<string, string> = {
    decision: "rgba(245,158,11,0.04)",
    win: "rgba(34,197,94,0.04)",
    blocker: "rgba(248,81,73,0.04)",
    question: "rgba(88,166,255,0.04)",
  };
  const bgTint = BG_TINT[accentKey ?? ""] ?? "transparent";

  const classes = [
    "post-card-main group relative border",
    isDecision ? "px-4 py-6" : "p-4",
    moved ? "moved-room-pulse" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`post-card-wrapper${isMine ? " mine" : ""}${repliesOpen ? " replies-open" : ""}`} id={`post-${post.id}`}>
    <article
      className={classes}
      style={{
        background: `linear-gradient(90deg, ${bgTint} 0%, #161b22 35%)`,
        // The left accent is set inline (shorthand → inline border-left-color),
        // so it always wins over the CSS base/hover border-color rules and can
        // never fade or change. The framing border-color lives in CSS so hover
        // can shift the top/right/bottom to the hover color.
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: "0 12px 12px 0",
        "--post-accent-color": accentColor,
        boxShadow: lateNight
          ? "0 0 22px 1px rgba(245, 158, 11, 0.10), 0 0 4px rgba(245, 158, 11, 0.06)"
          : undefined,
      } as CSSProperties}
    >
      {/* Top-right indicators — always visible */}
      <div className="absolute top-2 right-2 flex items-center gap-2 pointer-events-none">
        {(isDecision || isBlocker) && (
          <span
            aria-hidden
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#f59e0b", boxShadow: "0 0 6px rgba(245, 158, 11,0.7)" }}
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

      {/* Hover-only actions — sit to the left of indicators */}
      <div
        className="absolute top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ right: 56 }}
      >
        <BookmarkButton itemType={savedType} itemId={post.id} variant="inline" />
        <PostMenu
          postId={post.id}
          canDelete={
            !!currentUserId && !!post.author_id && currentUserId === post.author_id
          }
          onDeleted={() => onDeleted?.(post.id)}
        />
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
          <span className="relative inline-block" style={{ lineHeight: 0 }}>
            <Avatar
              name={post.author?.full_name}
              stage={post.author?.stage}
              username={post.author?.username}
              size={32}
              depthRing={!!post.authorDepthRing}
              anniversary={!!post.authorAnniversary}
            />
            {isOnline && <span aria-hidden className="presence-dot" />}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-mono lowercase text-xs text-text-primary truncate">
            {anon ? <span className="text-text-faint">anonymous</span> : post.author?.full_name?.toLowerCase() ?? "—"}
          </p>
          <p className="font-mono lowercase text-[0.65rem] text-text-faint">
            {timeAgo(post.created_at)} ago
            {anon && <span className="ml-2" style={{ fontSize: "9px" }}>· posted anonymously</span>}
          </p>
        </div>
      </header>

      <p className="text-text-secondary text-[0.92rem] leading-relaxed whitespace-pre-wrap">
        {post.content}
      </p>

      <footer className="flex items-center justify-between mt-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-3">
            {onToggleReplies ? (
              <button
                onClick={() => onToggleReplies(post.id)}
                className="reply-btn"
                style={{ fontSize: "0.65rem" }}
              >
                {String(post.reply_count ?? 0).padStart(2, "0")}{" "}
                {post.reply_count === 1 ? "reply" : "replies"}
              </button>
            ) : (
              <span className="font-mono lowercase text-[0.65rem] text-text-faint">
                {post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}
              </span>
            )}
            {onToggleReplies && (
              <button onClick={() => onToggleReplies(post.id)} className="reply-btn">
                reply →
              </button>
            )}
            <button onClick={handleShare} className="reply-btn" title="copy link to post">
              {shared ? "✓ copied" : "↗ share"}
            </button>
          </div>
          {(isDecision || isBlocker) && (
            <span
              className="font-mono lowercase tracking-wider"
              style={{ color: "#f59e0b", fontSize: "9px" }}
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
                border: `1px solid ${ROOM_TYPE_COLOR[roomType] ?? "#6e7681"}`,
                color: ROOM_TYPE_COLOR[roomType] ?? "#6e7681",
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
    {onToggleReplies && expanded && (
      <ReplyThread
        postId={post.id}
        postType={post.post_type}
        cohortId={post.cohort_id ?? null}
        currentUserId={currentUserId}
        onCollapse={() => onToggleReplies(post.id)}
        variant="attached"
      />
    )}
    </div>
  );
}
