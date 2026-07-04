import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/**
 * Tab pill row. Active = amber ghost fill; inactive = hairline border + muted.
 * Each pill can navigate (href) or fire onClick for client-side tab state.
 */
export function TabPill({
  children,
  active = false,
  href,
  onClick,
  radius = 8,
  style,
}: {
  children: ReactNode;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  radius?: number;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    padding: "5px 14px",
    borderRadius: radius,
    lineHeight: 1,
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
    ...(active
      ? {
          color: "#f8c56a",
          background: "rgba(245,158,11,.1)",
          border: "0.5px solid rgba(245,158,11,.28)",
        }
      : {
          color: "var(--text-secondary)",
          background: "transparent",
          border: "0.5px solid var(--border-default)",
        }),
    ...style,
  };

  if (href) {
    return (
      <Link href={href} style={base}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} style={base}>
      {children}
    </button>
  );
}

export function TabPillRow({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1.5 flex-wrap">{children}</div>;
}
