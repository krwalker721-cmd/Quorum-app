"use client";

import { useEffect, useState } from "react";

type Question = {
  id: string;
  question: string;
  question_type: "open_text" | "multiple_choice" | "rating";
  options: string[] | any;
};

export default function FeedbackPrompt() {
  const [q, setQ] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/feedback/active");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setQ(json.question ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function submit(value?: string) {
    if (!q) return;
    const val = value ?? response;
    if (!val.trim()) return;
    setBusy(true);
    const res = await fetch("/api/feedback/respond", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question_id: q.id, response: val }),
    });
    setBusy(false);
    if (res.ok) setDone(true);
  }

  async function dismiss() {
    if (!q) return;
    await fetch("/api/feedback/respond", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question_id: q.id, dismiss: true }),
    });
    setQ(null);
  }

  if (loading || !q) return null;

  return (
    <div
      className="border p-4"
      style={{ background: "var(--card)", borderColor: "var(--border-amber)" }}
    >
      <p
        className="font-mono uppercase text-amber mb-2"
        style={{ fontSize: "9px", letterSpacing: "0.08em" }}
      >
        quick question from the team
      </p>

      {done ? (
        <p className="text-text-secondary text-sm">thanks for the response.</p>
      ) : (
        <>
          <p className="text-text-secondary text-sm mb-3">{q.question}</p>

          {q.question_type === "open_text" && (
            <textarea
              rows={3}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="your answer"
            />
          )}

          {q.question_type === "multiple_choice" && Array.isArray(q.options) && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {q.options.map((opt: string) => (
                <button
                  key={opt}
                  onClick={() => submit(opt)}
                  disabled={busy}
                  className="font-mono lowercase text-[0.7rem] px-3 py-1.5 border disabled:opacity-50"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {q.question_type === "rating" && (
            <div className="flex gap-1.5 mb-3">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => submit(String(v))}
                  disabled={busy}
                  className="font-mono text-sm w-9 h-9 border disabled:opacity-50"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <button
              onClick={dismiss}
              className="font-mono lowercase text-[0.65rem] text-text-faint hover:text-text-muted"
            >
              not now
            </button>
            {q.question_type === "open_text" && (
              <button
                onClick={() => submit()}
                disabled={busy || !response.trim()}
                className="font-mono lowercase text-[0.7rem] px-3 py-1.5 disabled:opacity-50"
                style={{ background: "#f59e0b", color: "#000" }}
              >
                {busy ? "sending…" : "send →"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
