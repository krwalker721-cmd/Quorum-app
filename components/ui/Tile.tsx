import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import ui from "./sleek.module.css";

/**
 * The workhorse surface of the redesign. Every section lives in one of these
 * boxed tiles (open/divider-only layouts were explicitly rejected).
 *
 * Finish carried over from the landing page (sleek.module.css): a hairline
 * border, a faintly top-lit surface, and an amber edge on hover. The gradient
 * variant is the one amber hero tile per page, with a soft glow. The header is
 * a plain sentence-case label with an optional quiet link on the right.
 */
export default function Tile({
  kicker,
  kickerColor,
  right,
  rightHref,
  children,
  className = "",
  style,
  gradient = false,
  padding = "14px 16px",
}: {
  kicker?: ReactNode;
  kickerColor?: string;
  /** Right-aligned affordance in the header (usually a `label →` link). */
  right?: ReactNode;
  rightHref?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Amber hero gradient background (the one pop per page). */
  gradient?: boolean;
  padding?: string | number;
}) {
  const hasHeader = kicker != null || right != null;

  return (
    <section
      style={{ padding, ...style }}
      className={`${gradient ? ui.tileHero : ui.tile} ${className}`}
    >
      {hasHeader && (
        <div className="flex items-baseline justify-between" style={{ marginBottom: 10 }}>
          {kicker != null ? (
            <span className={ui.label} style={kickerColor ? { color: kickerColor } : undefined}>
              {kicker}
            </span>
          ) : (
            <span />
          )}
          {right != null &&
            (rightHref ? (
              <Link href={rightHref} className={ui.tileLink}>
                {right}
              </Link>
            ) : (
              <span className={ui.tileLink}>{right}</span>
            ))}
        </div>
      )}
      {children}
    </section>
  );
}
