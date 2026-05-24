"use client";

import { useEffect, useState, useCallback } from "react";
import { adminFetch, loadSession } from "../lib/api";
import { SectionShell } from "./Overview";

type Question = {
  id: string;
  question: string;
  question_type: "open_text" | "multiple_choice" | "rating";
  options: any;
  target_audience: string;
  status: "active" | "closed";
  created_at: string;
  response_count: number;
};

type Response = {
  id: string;
  response: string;
  created_at: string;
  user: { full_name: string | null; username: string | null } | null;
};

export default function FeedbackSection() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<Question | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);

  const load = useCallback(async () => {
    const res = await adminFetch("/api/admin/feedback");
    if (res.ok) {
      const json = await res.json();
      setQuestions(json.questions ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return setResponses([]);
    (async () => {
      const res = await adminFetch(`/api/admin/feedback/${selected.id}/responses`);
      if (res.ok) {
        const json = await res.json();
        setResponses(json.responses ?? []);
      }
    })();
  }, [selected]);

  async function closeQuestion(id: string) {
    await adminFetch("/api/admin/feedback", {
      method: "PATCH",
      body: JSON.stringify({ id, status: "closed" }),
    });
    load();
  }

  return (
    <SectionShell title="feedback">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CreateForm onCreated={load} />

        <div>
          <p className="font-mono lowercase text-[0.7rem] text-text-faint mb-2">questions</p>
          <div className="space-y-2">
            {questions.length === 0 ? (
              <p className="font-mono text-xs text-text-faint">no questions yet</p>
            ) : (
              questions.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelected(q)}
                  className="w-full text-left border p-3"
                  style={{
                    borderColor: selected?.id === q.id ? "#e8702a" : "var(--border)",
                    background: "var(--card)",
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="font-mono text-[0.55rem] lowercase px-1.5 py-0.5"
                      style={{
                        background: q.status === "active" ? "rgba(34,197,94,0.15)" : "rgba(112,112,112,0.15)",
                        color: q.status === "active" ? "#22c55e" : "#707070",
                      }}
                    >
                      {q.status}
                    </span>
                    <span className="font-mono text-[0.6rem] text-text-faint">
                      {q.response_count} responses
                    </span>
                  </div>
                  <p className="text-text-secondary text-sm">{q.question}</p>
                  <p className="font-mono text-[0.55rem] text-text-faint lowercase mt-1">
                    {q.question_type} Â· {q.target_audience}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {selected && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono lowercase text-[0.7rem] text-text-faint">
              responses Â· {selected.question}
            </p>
            <div className="flex gap-2">
              <a
                href={`/api/admin/feedback/${selected.id}/responses?format=csv`}
                onClick={async (e) => {
                  e.preventDefault();
                  const sess = loadSession();
                  if (!sess) return;
                  const res = await fetch(`/api/admin/feedback/${selected.id}/responses?format=csv`, {
                    headers: { "x-admin-code": sess.code },
                  });
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `feedback-${selected.id}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="font-mono lowercase text-[0.65rem] px-3 py-1.5 border"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                export csv
              </a>
              {selected.status === "active" && (
                <button
                  onClick={() => closeQuestion(selected.id)}
                  className="font-mono lowercase text-[0.65rem] px-3 py-1.5 border"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  close question
                </button>
              )}
            </div>
          </div>

          {selected.question_type === "rating" && responses.length > 0 && (
            <RatingSummary responses={responses} />
          )}

          <div className="border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
            {responses.length === 0 ? (
              <p className="font-mono text-xs text-text-faint p-4">no responses</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {responses.map((r) => (
                  <div key={r.id} className="px-4 py-2.5 flex items-start gap-3 text-[0.78rem]">
                    <div className="w-32 shrink-0">
                      <p className="text-text-secondary text-[0.78rem]">{r.user?.full_name ?? "â€”"}</p>
                      <p className="font-mono text-[0.55rem] text-text-faint lowercase">
                        @{r.user?.username ?? "â€”"}
                      </p>
                    </div>
                    <p className="text-text-secondary flex-1 whitespace-pre-wrap">{r.response}</p>
                    <span className="font-mono text-[0.6rem] text-text-faint shrink-0">
                      {r.created_at.slice(0, 10)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </SectionShell>
  );
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [question, setQuestion] = useState("");
  const [type, setType] = useState<"open_text" | "multiple_choice" | "rating">("open_text");
  const [optionsText, setOptionsText] = useState("");
  const [audience, setAudience] = useState("all_users");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const options =
      type === "multiple_choice"
        ? optionsText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const res = await adminFetch("/api/admin/feedback", {
      method: "POST",
      body: JSON.stringify({
        question,
        question_type: type,
        options,
        target_audience: audience,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setQuestion("");
      setOptionsText("");
      onCreated();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "failed");
    }
  }

  return (
    <form onSubmit={submit}>
      <p className="font-mono lowercase text-[0.7rem] text-text-faint mb-2">new question</p>
      <div className="border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div>
          <label>what do you want to ask?</label>
          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
          />
        </div>
        <div>
          <label>question type</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="open_text">open_text</option>
            <option value="multiple_choice">multiple_choice</option>
            <option value="rating">rating_1_to_5</option>
          </select>
        </div>
        {type === "multiple_choice" && (
          <div>
            <label>options (one per line)</label>
            <textarea
              rows={4}
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder={"option a\noption b"}
            />
          </div>
        )}
        <div>
          <label>target audience</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="all_users">all_users</option>
            <option value="tier_1_only">tier_1_only</option>
            <option value="tier_2_only">tier_2_only</option>
            <option value="free_only">free_only</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy || !question}
          className="w-full font-mono lowercase text-xs py-2.5 disabled:opacity-50"
          style={{ background: "#e8702a", color: "#000" }}
        >
          {busy ? "postingâ€¦" : "post question â†’"}
        </button>
      </div>
    </form>
  );
}

function RatingSummary({ responses }: { responses: Response[] }) {
  const nums = responses
    .map((r) => Number(r.response))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  const dist = [1, 2, 3, 4, 5].map((v) => ({
    v,
    n: nums.filter((x) => x === v).length,
  }));
  const max = Math.max(...dist.map((d) => d.n), 1);
  return (
    <div className="border p-4 mb-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <p className="font-mono text-[0.6rem] text-text-faint lowercase">average</p>
      <p className="font-mono text-2xl text-amber">{avg.toFixed(2)}</p>
      <div className="mt-3 space-y-1">
        {dist.map((d) => (
          <div key={d.v} className="flex items-center gap-2 text-[0.7rem]">
            <span className="font-mono text-text-faint w-4">{d.v}</span>
            <div className="flex-1 h-3" style={{ background: "var(--card-elev)" }}>
              <div
                style={{
                  width: `${(d.n / max) * 100}%`,
                  height: "100%",
                  background: "#e8702a",
                }}
              />
            </div>
            <span className="font-mono text-text-faint w-6 text-right">{d.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
