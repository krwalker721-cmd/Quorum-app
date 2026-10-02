import type { ReactNode } from "react";
import ui from "@/components/ui/sleek.module.css";
import { META } from "./kit";

export function DocIcon({ link }: { link: boolean }) {
  return (
    <span
      aria-hidden
      className="shrink-0 flex items-center justify-center"
      style={{
        width: 34,
        height: 34,
        borderRadius: 9,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        background: "rgba(255, 255, 255, 0.03)",
        color: link ? "#58a6ff" : "#f8c56a",
      }}
    >
      {link ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      )}
    </span>
  );
}

/**
 * One doc or link in a room's list: an icon, the title (a link when `href` is
 * set), a meta line, and an optional description and action.
 */
export default function RoomItemCard({
  link,
  title,
  href,
  meta,
  description,
  onOpen,
  action,
}: {
  link: boolean;
  title: string;
  href?: string | null;
  meta: ReactNode;
  description?: string | null;
  /** Makes the title a button (a doc that opens in the room). */
  onOpen?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className={`${ui.tile} flex items-start gap-3`} style={{ padding: "14px 16px" }}>
      <DocIcon link={link} />
      <div className="min-w-0 flex-1">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}
          >
            {title}
          </a>
        ) : onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="hover:underline text-left"
            style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}
          >
            {title}
          </button>
        ) : (
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{title}</p>
        )}
        <p style={{ ...META, marginTop: 2 }}>{meta}</p>
        {description && (
          <p
            className="whitespace-pre-wrap"
            style={{ fontSize: 12, lineHeight: 1.55, color: "var(--text-secondary)", marginTop: 8 }}
          >
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
