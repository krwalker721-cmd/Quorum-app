"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ui from "@/components/ui/sleek.module.css";
import { CountdownDigits } from "@/components/countdown/Countdown";
import { sprintDb } from "@/lib/hackathons/actions";
import { useServerNow } from "@/lib/useServerNow";
import { LABEL_RESET } from "@/lib/hackathons/submission";
import { RUBRIC, SCORE_COLUMNS, scoringWindow, type Score, type ScoreKey } from "@/lib/hackathons/judging";
import type { SprintState } from "@/lib/hackathons/sprint";

// A judge's score for one project (Phase 9). It saves by itself once all four
// scores are picked, and the notes a moment after typing stops. The database
// decides whether it may (020, 031): this judge, a complete submission, and
// between the deadline and judging_ends_at, which this panel also watches on
// the server's clock so it locks on time without a reload.

const NOTES_MAX = 5000;
const SAVE_AFTER_MS = { score: 250, notes: 1000 };

type Values = Record<ScoreKey, number | null>;
type Status = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

const valuesOf = (s: Score | null): Values => ({
  score_problem: s?.score_problem ?? null,
  score_shipped: s?.score_shipped ?? null,
  score_collaboration: s?.score_collaboration ?? null,
  score_potential: s?.score_potential ?? null,
});

export default function ScorePanel({
  sprint,
  submissionId,
  judgeId,
  initial,
  signals,
  prevHref,
  nextHref,
  nextScored,
}: {
  sprint: { state: SprintState; phase: string; ends_at: string | null; judging_ends_at: string | null };
  submissionId: string;
  judgeId: string;
  initial: Score | null;
  signals: { builders: number; messages: number; docs: number; links: number };
  prevHref: string | null;
  nextHref: string | null;
  nextScored: boolean;
}) {
  const [values, setValues] = useState<Values>(() => valuesOf(initial));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [row, setRow] = useState<Score | null>(initial);
  const [status, setStatus] = useState<Status>({ kind: initial ? "saved" : "idle" });

  const now = useServerNow();
  const win = now === null ? null : scoringWindow(sprint, now);
  const open = win === "open";

  const latest = useRef({ values, notes, row });
  latest.current = { values, notes, row };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const again = useRef(false);
  const pending = useRef(false);

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!pending.current) return;
    if (saving.current) {
      again.current = true;
      return;
    }
    const { values: v, notes: text, row: current } = latest.current;
    if (RUBRIC.some((r) => v[r.key] === null)) return; // waits for all four
    pending.current = false;
    saving.current = true;
    setStatus({ kind: "saving" });

    const fields = { ...(v as Record<ScoreKey, number>), notes: text.trim() ? text.slice(0, NOTES_MAX) : null };
    const db = sprintDb();
    let result = current
      ? await db.from("hackathon_scores").update(fields).eq("id", current.id).select(SCORE_COLUMNS).maybeSingle()
      : await db
          .from("hackathon_scores")
          .insert({ ...fields, submission_id: submissionId, judge_id: judgeId })
          .select(SCORE_COLUMNS)
          .maybeSingle();
    // Saved from another tab first: update that one instead.
    if (!current && result.error?.code === "23505") {
      result = await db
        .from("hackathon_scores")
        .update(fields)
        .eq("submission_id", submissionId)
        .eq("judge_id", judgeId)
        .select(SCORE_COLUMNS)
        .maybeSingle();
    }
    saving.current = false;

    if (result.error || !result.data) {
      pending.current = true;
      setStatus({ kind: "error", message: result.error?.message ?? "That didn't save. Try again." });
    } else {
      setRow(result.data as unknown as Score);
      setStatus({ kind: "saved" });
    }
    if (again.current) {
      again.current = false;
      void save();
    }
  }, [submissionId, judgeId]);

  const schedule = (ms: number) => {
    pending.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, ms);
  };

  // Save anything waiting when the judge leaves the page.
  useEffect(() => () => void save(), [save]);

  const complete = RUBRIC.every((r) => values[r.key] !== null);
  const statusLine =
    win === "not_yet"
      ? "Scoring opens when submissions close."
      : win === "frozen"
        ? sprint.state === "cancelled"
          ? "This Buildathon was cancelled."
          : "The Buildathon is paused, so scores are frozen."
        : win === "closed"
          ? row
            ? "Scoring is closed. This is the score you gave."
            : "Scoring is closed. You didn't score this one."
          : status.kind === "saving"
            ? "Saving…"
            : status.kind === "error"
              ? status.message
              : !complete
                ? "Pick all four to save."
                : status.kind === "saved"
                  ? "Saved"
                  : "";

  return (
    <div
      style={{
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 14,
        padding: "16px 16px 14px",
        background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0) 60%), var(--bg-surface)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Your score</h2>
        {open && sprint.judging_ends_at && (
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            closes in <CountdownDigits target={sprint.judging_ends_at} now={now} size="inline" />
          </span>
        )}
      </div>

      <div className="flex flex-col" style={{ gap: 14, marginTop: 12 }}>
        {RUBRIC.map((r) => (
          <div key={r.key}>
            <p id={`rubric-${r.key}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
              {r.label}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{r.question}</p>
            <div role="radiogroup" aria-labelledby={`rubric-${r.key}`} className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginTop: 7 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = values[r.key] === n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${r.label}: ${n}${n === 1 ? ` (${r.low})` : n === 5 ? ` (${r.high})` : ""}`}
                    disabled={!open}
                    onClick={() => {
                      setValues((prev) => ({ ...prev, [r.key]: n }));
                      schedule(SAVE_AFTER_MS.score);
                    }}
                    style={{
                      fontFamily: "inherit",
                      fontSize: 14,
                      fontWeight: on ? 650 : 500,
                      padding: "8px 0",
                      borderRadius: 8,
                      border: `1px solid ${on ? "rgba(245, 158, 11, 0.6)" : "rgba(255, 255, 255, 0.08)"}`,
                      background: on ? "rgba(245, 158, 11, 0.18)" : "rgba(0, 0, 0, 0.15)",
                      color: on ? "#f8c56a" : "var(--text-secondary)",
                      cursor: open ? "pointer" : "default",
                      opacity: !open && !on ? 0.5 : 1,
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between" style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>
              <span>{r.low}</span>
              <span>{r.high}</span>
            </div>
          </div>
        ))}
      </div>

      <label className="block" style={{ ...LABEL_RESET, marginTop: 16 }}>
        <span className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Notes</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>only you and the admins</span>
        </span>
        <textarea
          value={notes}
          maxLength={NOTES_MAX}
          readOnly={!open}
          rows={4}
          placeholder={open ? "What stood out, what didn't. Helps when choosing awards." : ""}
          onChange={(e) => {
            setNotes(e.target.value);
            schedule(SAVE_AFTER_MS.notes);
          }}
          onBlur={() => void save()}
          className={ui.search}
          style={{ width: "100%", resize: "vertical", lineHeight: 1.5, fontSize: 13.5 }}
        />
      </label>

      <p
        role="status"
        style={{
          fontSize: 12,
          minHeight: 18,
          marginTop: 8,
          color: status.kind === "error" && open ? "#f87171" : status.kind === "saved" && open && complete ? "#4ade80" : "var(--text-muted)",
        }}
      >
        {statusLine}
      </p>

      <div className={ui.cardFoot}>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>How the team worked</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.55 }}>
          {signals.builders} {signals.builders === 1 ? "builder" : "builders"} · {signals.messages}{" "}
          {signals.messages === 1 ? "message" : "messages"} · {signals.docs} {signals.docs === 1 ? "doc" : "docs"} · {signals.links}{" "}
          {signals.links === 1 ? "link" : "links"}
        </p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Counts only. Team rooms stay sealed, from judges too.</p>
      </div>

      <div className="flex items-center justify-between gap-2" style={{ marginTop: 14 }}>
        {prevHref ? (
          <Link href={prevHref} className={ui.ghostBtn} style={{ textDecoration: "none" }} onClick={() => void save()}>
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {nextHref && (
          <Link
            href={nextHref}
            className={complete && open && !nextScored ? ui.primaryBtn : ui.softBtn}
            style={{ textDecoration: "none" }}
            onClick={() => void save()}
          >
            {nextScored ? "Next project →" : "Next to score →"}
          </Link>
        )}
      </div>
    </div>
  );
}
