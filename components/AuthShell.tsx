import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import LogoMark from "@/components/LogoMark";
import NoGrid from "@/components/ui/NoGrid";
import ui from "@/components/ui/sleek.module.css";

// The signed-out pages (login, signup, pending, password reset) in the sleek
// finish: one centred column with the logo, a gradient heading, and a hairline
// card. No background grid, and a faint static amber glow at the top.
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  width = 400,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <main className={`min-h-screen flex items-center justify-center px-5 py-12 ${ui.pageGlow}`}>
      <NoGrid />
      <div className="w-full" style={{ maxWidth: width }}>
        <Link href="/" className="flex items-center justify-center gap-2.5" aria-label="Quorum home">
          <LogoMark size={34} />
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
            quorum
          </span>
        </Link>
        <h1
          className={`${ui.titleGradient} ${ui.balance}`}
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            lineHeight: 1.2,
            textAlign: "center",
            marginTop: 28,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={ui.balance}
            style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)", textAlign: "center", marginTop: 8 }}
          >
            {subtitle}
          </p>
        )}
        <div style={{ marginTop: 24 }}>{children}</div>
        {footer && (
          <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>{footer}</div>
        )}
      </div>
    </main>
  );
}

/** The hairline card that holds a form or a message. */
export const AUTH_CARD: CSSProperties = {
  position: "relative",
  background:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0) 40%), var(--bg-surface)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 14,
  padding: 24,
  boxShadow: "0 24px 60px -30px rgba(0, 0, 0, 0.7)",
};

/** Sentence-case sans label. Explicit, because the global `label` rule is
 *  lowercase mono. */
export const AUTH_LABEL: CSSProperties = {
  fontFamily: "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif",
  textTransform: "none",
  letterSpacing: 0,
  fontSize: 13,
  color: "var(--text-secondary)",
  marginBottom: 6,
};

export const AUTH_ERROR: CSSProperties = { fontSize: 13, lineHeight: 1.5, color: "#f87171" };

/** Amber text link on the auth pages. */
export const AUTH_LINK: CSSProperties = { color: "#f8c56a" };

/** Capitalise the first letter of a message that arrives lowercase (Supabase
 *  errors, the ?error= line from /auth/callback). */
export function sentence(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
