import Link from "next/link";
import type { CSSProperties } from "react";
import { STAGE_COLOR, initials } from "@/lib/stage";

/**
 * Redesign avatar: `#1c2128` circle, mono initials, optional stage-colored ring
 * (identity, not noise) and optional green "active now" dot bottom-right.
 * Stage ring colors: idea=blue, pre-seed=amber, seed=green, series_a=purple.
 */
export default function PersonAvatar({
  name,
  stage,
  size = 28,
  username,
  ringColor,
  active = false,
  color,
}: {
  name?: string | null;
  stage?: string | null;
  size?: number;
  username?: string | null;
  /** Explicit ring color; otherwise derived from stage. Pass null for no ring. */
  ringColor?: string | null;
  active?: boolean;
  /** Initials text color (defaults to secondary; mockup tints to match ring). */
  color?: string;
}) {
  const ring =
    ringColor === null
      ? null
      : ringColor ?? (stage ? STAGE_COLOR[stage] ?? null : null);

  const circle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: "var(--bg-elevated)",
    color: color ?? "var(--text-secondary)",
    fontSize: Math.max(8, size * 0.34),
    flexShrink: 0,
    border: ring ? `1.5px solid ${ring}` : "0.5px solid var(--border-muted)",
  };

  const inner = (
    <span
      className="relative inline-flex"
      style={{ width: size, height: size, lineHeight: 0 }}
    >
      <span
        className="flex items-center justify-center font-mono uppercase"
        style={circle}
      >
        {initials(name)}
      </span>
      {active && (
        <span
          aria-hidden
          className="absolute"
          style={{
            bottom: 0,
            right: 0,
            width: Math.max(7, size * 0.25),
            height: Math.max(7, size * 0.25),
            borderRadius: "50%",
            background: "var(--green)",
            border: "1.5px solid var(--bg-surface)",
          }}
        />
      )}
    </span>
  );

  if (!username) return inner;
  return (
    <Link href={`/profile/${username}`} aria-label={`view ${name ?? "profile"}`}>
      {inner}
    </Link>
  );
}
