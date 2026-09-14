"use client";

import { useState, type CSSProperties } from "react";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/stage";
import { is2amPost } from "@/lib/recognition";
import { usePresence } from "@/components/PresenceProvider";
import BookmarkButton from "@/components/BookmarkButton";
import PostMenu from "@/components/PostMenu";
import ReplyThread from "@/components/ReplyThread";
import ui from "@/components/ui/sleek.module.css";

const LATE_NIGHT_GLOW = "0 0 22px 1px rgba(245, 158, 11, 0.10), 0 0 4px rgba(245, 158, 11, 0.06)";

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
  sleek = false,
}: {
  post: PostWithAuthor;
  currentUserId?: string | null;
  onDeleted?: (postId: string) => void;
  // When provided, the reply count + "reply →" become controls that expand the
  // thread inline. Omit (e.g. profile listing) to render an inert reply count.
  expanded?: boolean;
  onToggleReplies?: (postId: string) => void;
  /** The landing page's finish (sleek.module.css): hairline tile, readable
   *  sans-serif meta, sentence case. Opt-in while pages convert (pulse first);
   *  the cohort room and profile still render the classic card. */
  sleek?: boolean;
}) {
  const anon = post.is_anonymous;
  const lateNight = is2amPost(post);
  const moved = !!post.movedTheRoom;

  const online = usePresence();
  const isOnline = !anon && !!post.author_id && online.has(post.author_id);
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
  const isQuestion = roomType === "question";
  const isActive = !!post.isActive;

  // The one amber "pop" in the feed: an active decision floats up as a gradient
  // hero tile. Everything else is a calm neutral box (tweet anatomy).
  const heroDecision = isDecision && isActive;

  // Room-type pill treatment: decision = amber ghost, everything else neutral.
  const pillLabel = roomType ?? post.tag ?? null;
  const pillColor = isDecision ? "#f8c56a" : "var(--text-secondary)";
  const pillBorder = isDecision ? "rgba(245,158,11,.35)" : "var(--border-muted)";

  const replies = post.reply_count ?? 0;
  const replyCount = `${replies} ${replies === 1 ? "reply" : "replies"}`;
  const replyLabel = sleek
    ? replies === 0 && onToggleReplies
      ? "Reply"
      : replyCount
    : `◌ ${replyCount}`;

  return (
    <div
      className={`post-card-wrapper${repliesOpen ? " replies-open" : ""}`}
      id={`post-${post.id}`}
      // Sleek cards fill their column so they line up with the composer.
      style={sleek ? { maxWidth: "none" } : undefined}
    >
    <article
      className={`group relative${moved ? " moved-room-pulse" : ""}${
        sleek ? ` ${heroDecision ? ui.tileHero : ui.tile}` : ""
      }`}
      style={
        (sleek
          ? {
              padding: "16px 18px",
              ...(repliesOpen ? { borderRadius: "12px 12px 0 0" } : {}),
              ...(lateNight ? { boxShadow: LATE_NIGHT_GLOW } : {}),
            }
          : {
              background: heroDecision
                ? "linear-gradient(150deg, rgba(245,158,11,.16), rgba(245,158,11,.03) 60%)"
                : "var(--bg-surface)",
              border: `0.5px solid ${heroDecision ? "rgba(245,158,11,.3)" : "var(--border-default)"}`,
              borderRadius: "var(--radius-card, 12px)",
              padding: "14px 15px",
              boxShadow: lateNight ? LATE_NIGHT_GLOW : undefined,
            }) as CSSProperties
      }
    >
      {/* Delete menu — hover only, top-right */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <PostMenu
          postId={post.id}
          canDelete={!!currentUserId && !!post.author_id && currentUserId === post.author_id}
          onDeleted={() => onDeleted?.(post.id)}
        />
      </div>

      <div className="flex gap-2.5">
        {anon ? (
          <div
            className="flex items-center justify-center font-mono text-[0.6rem] lowercase shrink-0"
            style={{ width: 36, height: 36, background: "var(--bg-elevated)", color: "var(--text-faint)", borderRadius: "50%" }}
          >
            ??
          </div>
        ) : (
          /* self-start: as a stretched flex item this span ran the card's full
             height, which parked the presence dot at the card's bottom. */
          <span className="relative inline-block shrink-0 self-start" style={{ lineHeight: 0 }}>
            <Avatar
              name={post.author?.full_name}
              stage={post.author?.stage}
              username={post.author?.username}
              size={36}
              depthRing={!!post.authorDepthRing}
              anniversary={!!post.authorAnniversary}
            />
            {isOnline && <span aria-hidden className="presence-dot" />}
          </span>
        )}

        <div className="flex-1 min-w-0">
          {/* Name · stage · time · type pill (tweet header line) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span style={{ fontSize: sleek ? 14 : 13, fontWeight: 500, color: "var(--text-primary)" }}>
              {anon ? (
                <span style={{ color: "var(--text-faint)" }}>{sleek ? "Anonymous" : "anonymous"}</span>
              ) : (
                post.author?.full_name ?? "—"
              )}
            </span>
            <span
              className={sleek ? undefined : "font-mono"}
              style={{ fontSize: sleek ? 12 : 10, color: "var(--text-muted)" }}
            >
              {!anon && post.author?.stage ? `· ${post.author.stage} ` : "· "}
              {timeAgo(post.created_at)}
            </span>
            {pillLabel &&
              (sleek ? (
                <span
                  className={ui.chip}
                  style={isDecision ? { color: pillColor, borderColor: pillBorder } : undefined}
                >
                  {pillLabel.charAt(0).toUpperCase() + pillLabel.slice(1)}
                </span>
              ) : (
                <span
                  className="font-mono lowercase"
                  style={{
                    fontSize: 9,
                    color: pillColor,
                    border: `0.5px solid ${pillBorder}`,
                    padding: "0 6px",
                    borderRadius: 10,
                    lineHeight: 1.7,
                  }}
                >
                  {pillLabel}
                </span>
              ))}
            {isActive &&
              !anon &&
              (sleek ? (
                <span style={{ fontSize: 12, color: "var(--green)" }}>● Active</span>
              ) : (
                <span className="font-mono" style={{ fontSize: 9, color: "var(--green)" }}>
                  ● active
                </span>
              ))}
          </div>

          <p
            className="whitespace-pre-wrap"
            style={{
              fontSize: sleek ? 14 : 13,
              lineHeight: sleek ? 1.6 : 1.5,
              marginTop: sleek ? 6 : 4,
              color: "var(--text-primary)",
            }}
          >
            {post.content}
          </p>

          {/* Action bar */}
          <div
            className="flex items-center"
            style={
              sleek
                ? { gap: 20, marginTop: 12, fontSize: 12, color: "var(--text-muted)" }
                : { gap: 22, marginTop: 9, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }
            }
          >
            {onToggleReplies ? (
              <button onClick={() => onToggleReplies(post.id)} className={sleek ? ui.textBtn : "reply-btn"}>
                {replyLabel}
              </button>
            ) : (
              <span>{replyLabel}</span>
            )}
            <button onClick={handleShare} className={sleek ? ui.textBtn : "reply-btn"} title="copy link to post">
              {sleek ? (shared ? "✓ Copied" : "Share") : shared ? "✓ copied" : "↱ share"}
            </button>
            <BookmarkButton itemType={savedType} itemId={post.id} variant="inline" />
          </div>
        </div>
      </div>
    </article>
    {onToggleReplies && expanded && (
      <ReplyThread
        postId={post.id}
        postType={post.post_type}
        cohortId={post.cohort_id ?? null}
        currentUserId={currentUserId}
        onCollapse={() => onToggleReplies(post.id)}
        variant="attached"
        sleek={sleek}
      />
    )}
    </div>
  );
}
