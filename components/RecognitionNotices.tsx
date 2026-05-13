"use client";

import { useState } from "react";

type Notice = {
  id: string;
  kind: "first_honest" | "connector";
  payload?: Record<string, any> | null;
};

const TEXT: Record<Notice["kind"], string> = {
  first_honest: "it takes courage to be honest in a room. that matters here.",
  connector: "something you started is still going.",
};

export default function RecognitionNotices({ notices }: { notices: Notice[] }) {
  const [visible, setVisible] = useState<Notice[]>(notices);

  async function dismiss(id: string) {
    setVisible((prev) => prev.filter((n) => n.id !== id));
    fetch("/api/recognition/dismiss", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  if (visible.length === 0) return null;

  return (
    <div className="px-6 pt-4 space-y-2">
      {visible.map((n) => (
        <button
          key={n.id}
          onClick={() => dismiss(n.id)}
          className="quiet-notice w-full text-left px-4 py-3 transition-opacity hover:opacity-80"
        >
          <p className="font-mono lowercase text-[0.75rem] text-text-muted">
            {TEXT[n.kind]}
          </p>
        </button>
      ))}
    </div>
  );
}
