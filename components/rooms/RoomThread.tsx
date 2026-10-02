"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import ui from "@/components/ui/sleek.module.css";
import { timeAgo } from "@/lib/stage";
import { META, PANEL } from "./kit";

/** One line of a room's thread, whichever room it comes from. */
export type RoomMessage = {
  id: string;
  authorId: string | null;
  body: string;
  isSystem: boolean;
  createdAt: string;
  /** Soft-deleted (the Hackathon room blanks the text and keeps the row). */
  deleted?: boolean;
};

/**
 * A room's chat thread: the messages and the composer. The room owns the data
 * and passes `onSend`, which resolves true once the message is saved.
 */
export default function RoomThread({
  messages,
  currentUserId,
  nameOf,
  onSend,
  placeholder = "Message the team…",
  notice,
  closed,
}: {
  messages: RoomMessage[];
  currentUserId: string;
  nameOf: (userId: string) => string | null | undefined;
  onSend: (text: string) => Promise<boolean>;
  placeholder?: string;
  /** Shown above the composer (a failed send, say). */
  notice?: ReactNode;
  /** Replaces the composer when the room is read-only. */
  closed?: ReactNode;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    const ok = await onSend(trimmed);
    setBusy(false);
    if (ok) setText("");
  }

  const canSend = !busy && !!text.trim();

  return (
    <div
      className="flex flex-col"
      style={{
        ...PANEL,
        // Fill the space left under the header/tabs so the composer stays in
        // view without the page scrolling; scrolls internally when long.
        height: "calc(100dvh - 330px)",
        minHeight: 340,
        maxHeight: 640,
        overflow: "hidden",
      }}
    >
      <div
        ref={scrollRef}
        className="scroll-thin"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className={ui.emptyTitle}>No messages yet.</p>
            <p className={ui.emptySub}>Start the conversation.</p>
          </div>
        ) : (
          messages.map((m) => {
            if (m.isSystem) {
              return (
                <p
                  key={m.id}
                  className="text-center"
                  style={{ ...META, alignSelf: "center", maxWidth: "80%" }}
                >
                  {m.body} · {timeAgo(m.createdAt)} ago
                </p>
              );
            }
            const mine = m.authorId === currentUserId;
            return (
              <div
                key={m.id}
                style={{
                  maxWidth: "75%",
                  alignSelf: mine ? "flex-end" : "flex-start",
                  padding: "10px 14px",
                  ...(mine
                    ? {
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: "16px 16px 6px 16px",
                        background: "linear-gradient(150deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.07) 70%)",
                        boxShadow: "0 10px 30px -20px rgba(245, 158, 11, 0.6)",
                      }
                    : {
                        border: "1px solid rgba(255, 255, 255, 0.07)",
                        borderRadius: "16px 16px 16px 6px",
                        background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0) 60%), var(--card)",
                      }),
                }}
              >
                {!mine && (
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>
                    {(m.authorId ? nameOf(m.authorId) : null) ?? "—"}
                  </p>
                )}
                {m.deleted ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 13, fontStyle: "italic", lineHeight: 1.6 }}>
                    Message deleted
                  </p>
                ) : (
                  <p style={{ color: "var(--text-primary)", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {m.body}
                  </p>
                )}
                <p style={{ fontSize: 10.5, color: mine ? "rgba(248, 197, 106, 0.75)" : "var(--text-muted)", marginTop: 4 }}>
                  {timeAgo(m.createdAt)} ago
                </p>
              </div>
            );
          })
        )}
      </div>
      {notice}
      {closed ?? (
        <div
          className="flex items-center gap-2.5"
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", padding: "12px 14px" }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={placeholder}
            aria-label={placeholder.replace(/…$/, "")}
            className={`${ui.search} flex-1 min-w-0`}
            style={{ colorScheme: "dark" }}
          />
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            aria-label="Send message"
            className={ui.primaryBtn}
            style={{
              width: 38,
              height: 38,
              padding: 0,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M13 1L1 7L6 8M13 1L7 13L6 8M13 1L6 8"
                stroke="#1a1204"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
