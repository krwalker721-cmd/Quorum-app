import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

const SOLID: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(245,158,11,.92), rgba(245,158,11,.72))",
  border: "none",
  color: "#1a1204",
  fontWeight: 500,
};

const GHOST: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(245,158,11,.2), rgba(245,158,11,.06))",
  border: "0.5px solid rgba(245,158,11,.32)",
  color: "#f8c56a",
  fontWeight: 500,
};

/**
 * The amber "pop" — used sparingly on the hero moment / primary CTA per page.
 *  - variant="solid": filled amber gradient (primary action).
 *  - variant="ghost": the `+ post` treatment (subtle amber wash).
 * Renders an <a> when `href` is set, otherwise a <button>.
 */
export default function GradientButton({
  children,
  href,
  onClick,
  variant = "solid",
  size = 11,
  className = "",
  style,
  type = "button",
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "solid" | "ghost";
  size?: number;
  className?: string;
  style?: CSSProperties;
  type?: "button" | "submit";
}) {
  const base: CSSProperties = {
    ...(variant === "solid" ? SOLID : GHOST),
    fontFamily: "var(--font-mono)",
    fontSize: size,
    padding: "6px 13px",
    borderRadius: "var(--radius-ctl, 8px)",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    lineHeight: 1,
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
    ...style,
  };

  if (href) {
    return (
      <Link href={href} className={className} style={base}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} className={className} style={base}>
      {children}
    </button>
  );
}
