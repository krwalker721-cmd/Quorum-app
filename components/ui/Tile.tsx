import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import MonoKicker from "./MonoKicker";

/**
 * The workhorse surface of the redesign. Every section lives in one of these
 * boxed tiles (open/divider-only layouts were explicitly rejected).
 *
 *   background:#161b22; border:0.5px solid #21262d; radius:12px; padding:14–18px
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
  const base: CSSProperties = gradient
    ? {
        background:
          "linear-gradient(150deg, rgba(245,158,11,.16), rgba(245,158,11,.03) 60%)",
        border: "0.5px solid rgba(245,158,11,.3)",
        borderRadius: "var(--radius-card, 12px)",
      }
    : {
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-card, 12px)",
      };

  const hasHeader = kicker != null || right != null;

  return (
    <section style={{ ...base, padding, ...style }} className={className}>
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
