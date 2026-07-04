import type { CSSProperties, ReactNode } from "react";

/**
 * Mono uppercase micro-kicker on section headers — the "terminal as seasoning"
 * accent. Content stays the loudest thing; these are quiet labels.
 *
 *   font-mono; ~9–10px; letter-spacing .12–.14em; uppercase
 *   #484f58 on bare bg / #6e7681 inside a tile
 */
export default function MonoKicker({
  children,
  color = "var(--text-muted)",
  size = 9,
  className = "",
  style,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`font-mono uppercase ${className}`}
      style={{
        fontSize: size,
        letterSpacing: "0.12em",
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
