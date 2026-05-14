"use client";

import { useState } from "react";

type Notice = {
  id: string;
  kind: "first_honest" | "connector" | "stage_advance";
  payload?: Record<string, any> | null;
};

const STATIC_TEXT: Record<"first_honest" | "connector", string> = {
  first_honest: "it takes courage to be honest in a room. that matters here.",
  connector: "something you started is still going.",
};

const STAGE_ADVANCE_TEXT: Record<string, string> = {
  "pre-seed": "pre-seed. the idea is real enough to bet on. keep going.",
  seed: "seed stage. someone else believes in this now too.",
  series_a: "series_a. you built something worth scaling.",
};

function textFor(n: Notice): string {
  if (n.kind === "stage_advance") {
    const to = (n.payload?.to as string) ?? "";
    return (
      (n.payload?.copy as string) ??
      STAGE_ADVANCE_TEXT[to] ??
      "stage advanced."
    );
  }
  return STATIC_TEXT[n.kind];
}

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
            {textFor(n)}
          </p>
        </button>
      ))}
    </div>
  );
}
