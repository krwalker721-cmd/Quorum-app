import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import MonoKicker from "./MonoKicker";
import ui from "./sleek.module.css";

/**
 * The workhorse surface of the redesign. Every section lives in one of these
 * boxed tiles (open/divider-only layouts were explicitly rejected).
 *
 * Finish carried over from the landing page (sleek.module.css): a hairline
 * border, a faintly top-lit surface, and an amber edge on hover. The gradient
 * variant is the one amber hero tile per page, with a soft glow.
 *
 * Optional MonoKicker header with an optional right-aligned link (`all →`).
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
        <div className="flex items-baseline justify-between" style={{ marginBottom: 11 }}>
          {kicker != null ? (
            <MonoKicker color={kickerColor}>{kicker}</MonoKicker>
          ) : (
            <span />
          )}
          {right != null &&
            (rightHref ? (
              <Link
                href={rightHref}
                className="font-mono"
                style={{ fontSize: 10, color: "var(--blue)", textDecoration: "none" }}
              >
                {right}
              </Link>
            ) : (
              <span className="font-mono" style={{ fontSize: 10, color: "var(--blue)" }}>
                {right}
              </span>
            ))}
        </div>
      )}
      {children}
    </section>
  );
}
