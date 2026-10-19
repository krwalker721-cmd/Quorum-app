"use client";

import { useMemo, useState } from "react";
import Countdown from "@/components/countdown/Countdown";
import { TeamBadge } from "@/components/hackathon/TeamStyle";
import { ProjectScreen } from "@/components/hackathon/showcase/Theatre";
import ui from "@/components/ui/sleek.module.css";
import { sprintDb } from "@/lib/hackathons/actions";
import { LABEL_RESET } from "@/lib/hackathons/submission";
import { REVIEW_COLUMNS, REVIEW_QUESTIONS, type MyReview } from "@/lib/hackathons/reviewShared";
import { sayBuildathon } from "@/lib/hackathons/defaults";
import s from "./reviews.module.css";

// The peer review round (036), for someone who competed: from the deadline
// to the reveal, a few other teams' projects, one at a time. Three quick
// ratings, two optional lines, then a favourite among them. Answers save as
// you go and can be changed until reviews close. The awards work themselves
// out at the reveal.

const QUESTIONS = REVIEW_QUESTIONS;

export default function ReviewFlow({
  sprint,
  initial,
  preview = false,
}: {
  sprint: { number: number; judgingEndsAt: string | null };
  initial: MyReview[];
  /** Development only: answers change on screen, never in the database. */
  preview?: boolean;
}) {
  const [reviews, setReviews] = useState(initial);
  const firstOpen = reviews.findIndex((r) => !r.completed_at);
  const allDone = firstOpen === -1;
  const hasFavourite = reviews.some((r) => r.is_favourite);
  // Where you are: a review (0…n-1), the favourite step (n), or done (n+1).
  const [step, setStep] = useState(allDone ? (hasFavourite ? reviews.length + 1 : reviews.length) : firstOpen);
  const [draft, setDraft] = useState<Partial<MyReview>>(() => (allDone ? {} : pick(reviews[firstOpen])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = reviews.filter((r) => r.completed_at).length;
  const n = reviews.length;

  function go(i: number) {
    setError(null);
    setStep(i);
    if (i < n) setDraft(pick(reviews[i]));
  }

  async function save() {
    const r = reviews[step];
    if (!r) return;
    setSaving(true);
    setError(null);
    if (preview) {
      const filled = { ...r, ...draft, completed_at: draft.score_problem && draft.score_works && draft.score_use ? new Date().toISOString() : null };
      const next = reviews.map((x) => (x.id === r.id ? filled : x));
      setReviews(next);
      setSaving(false);
      const open = next.findIndex((x, i) => i > step && !x.completed_at);
      const anyOpen = next.findIndex((x) => !x.completed_at);
      go(open !== -1 ? open : anyOpen !== -1 ? anyOpen : n);
      return;
    }
    const { data, error: e } = await sprintDb()
      .from("hackathon_reviews")
      .update({
        score_problem: draft.score_problem ?? null,
        score_works: draft.score_works ?? null,
        score_use: draft.score_use ?? null,
        strength: draft.strength ?? null,
        suggestion: draft.suggestion ?? null,
      })
      .eq("id", r.id)
      .select(REVIEW_COLUMNS)
      .single();
    setSaving(false);
    if (e || !data) {
      setError(/closed/i.test(e?.message ?? "") ? "Reviews have closed." : e?.message ?? "That didn't save. Try again.");
      return;
    }
    const next = reviews.map((x) => (x.id === r.id ? { ...x, ...(data as Partial<MyReview>) } : x));
    setReviews(next);
    const open = next.findIndex((x, i) => i > step && !x.completed_at);
    const anyOpen = next.findIndex((x) => !x.completed_at);
    go(open !== -1 ? open : anyOpen !== -1 ? anyOpen : n);
  }

  async function favourite(id: string) {
    if (preview) {
      setReviews((list) => list.map((x) => ({ ...x, is_favourite: x.id === id })));
      setStep(n + 1);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: e } = await sprintDb().rpc("hackathon_pick_favourite", { p_review_id: id });
    setSaving(false);
    if (e) return setError(sayBuildathon(e.message));
    setReviews((list) => list.map((x) => ({ ...x, is_favourite: x.id === id })));
    setStep(n + 1);
  }

  const current = step < n ? reviews[step] : null;
  const complete = Boolean(draft.score_problem && draft.score_works && draft.score_use);
  const order = useMemo(() => reviews.map((r, i) => ({ r, i })), [reviews]);

  return (
    <section className={s.flow} aria-label="Review round">
      <header className={s.head}>
        <div className="min-w-0">
          <p className={s.kicker}>Review round</p>
          <h2 className={s.title}>
            {step > n ? "Thanks for reviewing" : step === n ? "Pick your favourite" : `Review ${step + 1} of ${n}`}
          </h2>
          <p className={s.sub}>
            Rate a few other teams&rsquo; projects. Your ratings decide the awards; your feedback goes to the team, without your name.
          </p>
        </div>
        {sprint.judgingEndsAt && (
          <div className={s.clock}>
            <span>Reviews close in</span>
            <Countdown target={sprint.judgingEndsAt} size="inline" />
          </div>
        )}
      </header>

      <div className={s.progress} aria-label={`${done} of ${n} reviewed`}>
        {order.map(({ r, i }) => (
          <button
            key={r.id}
            type="button"
            className={`${s.dot} ${r.completed_at ? s.dotDone : ""} ${i === step ? s.dotOn : ""}`}
            onClick={() => go(i)}
            title={r.project?.fields.project_name || `Review ${i + 1}`}
            aria-label={`Review ${i + 1}${r.completed_at ? ", done" : ""}`}
          />
        ))}
        <span className={s.progressText}>
          {done} of {n} done
        </span>
      </div>

      {current && (
        <div className={s.body}>
          <div className={s.stage}>
            {current.project ? (
              <ProjectScreen project={current.project} className={s.screen} />
            ) : (
              <div className={s.missing}>This project isn&rsquo;t available.</div>
            )}
            {current.project && (
              <div className={s.who}>
                <TeamBadge name={current.project.team.name} emblem={current.project.team.emblem} color={current.project.team.color} size={22} />
                <div className="min-w-0">
                  <p className={s.projectName}>{current.project.fields.project_name || "Untitled project"}</p>
                  {current.project.fields.tagline && <p className={s.tagline}>{current.project.fields.tagline}</p>}
                </div>
                <span className={s.links}>
                  {current.project.deckUrl && (
                    <a href={current.project.deckUrl} target="_blank" rel="noopener noreferrer">
                      Open the deck ↗
                    </a>
                  )}
                  {/^https?:\/\//i.test(current.project.fields.demo_url) && (
                    <a href={current.project.fields.demo_url} target="_blank" rel="noopener noreferrer nofollow">
                      Demo ↗
                    </a>
                  )}
                </span>
              </div>
            )}
            {current.project?.fields.problem && <p className={s.problem}>{current.project.fields.problem}</p>}
          </div>

          <form
            className={s.form}
            onSubmit={(e) => {
              e.preventDefault();
              if (complete) void save();
            }}
          >
            {QUESTIONS.map((q) => (
              <fieldset key={q.key} className={s.question}>
                <legend className={s.q}>{q.q}</legend>
                <div className={s.scale} role="radiogroup" aria-label={q.q}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={draft[q.key] === v}
                      className={`${s.pt} ${draft[q.key] === v ? s.ptOn : ""}`}
                      onClick={() => setDraft((d) => ({ ...d, [q.key]: v }))}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className={s.ends}>
                  <span>{q.low}</span>
                  <span>{q.high}</span>
                </div>
              </fieldset>
            ))}
            <label className={s.field} style={LABEL_RESET}>
              <span className={s.fieldLabel}>The strongest part (optional)</span>
              <input
                value={draft.strength ?? ""}
                maxLength={280}
                onChange={(e) => setDraft((d) => ({ ...d, strength: e.target.value }))}
                placeholder="What's the best thing about it?"
              />
            </label>
            <label className={s.field} style={LABEL_RESET}>
              <span className={s.fieldLabel}>One suggestion (optional)</span>
              <input
                value={draft.suggestion ?? ""}
                maxLength={280}
                onChange={(e) => setDraft((d) => ({ ...d, suggestion: e.target.value }))}
                placeholder="What would make it better?"
              />
            </label>
            {error && <p className={s.error}>{error}</p>}
            <div className={s.actions}>
              {step > 0 && (
                <button type="button" className={ui.textBtn} onClick={() => go(step - 1)}>
                  ‹ Back
                </button>
              )}
              <button type="submit" className={ui.primaryBtn} disabled={!complete || saving}>
                {saving ? "Saving…" : step === n - 1 || reviews.filter((x) => !x.completed_at && x.id !== current.id).length === 0 ? "Save and finish →" : "Save and next →"}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === n && (
        <div className={s.favourites}>
          <p className={s.sub} style={{ marginTop: 0 }}>
            Of the projects you reviewed, which one did you like most? It counts toward the Crowd favourite award.
          </p>
          <div className={s.favGrid}>
            {reviews.map((r) =>
              r.project ? (
                <button
                  key={r.id}
                  type="button"
                  className={`${s.fav} ${r.is_favourite ? s.favOn : ""}`}
                  disabled={!r.completed_at || saving}
                  onClick={() => void favourite(r.id)}
                  style={{ ["--team" as string]: r.project.team.color ?? "#f59e0b" }}
                >
                  <TeamBadge name={r.project.team.name} emblem={r.project.team.emblem} color={r.project.team.color} size={28} />
                  <span className="min-w-0">
                    <span className={s.favName}>{r.project.fields.project_name || "Untitled project"}</span>
                    <span className={s.favTeam}>{r.project.team.name}</span>
                  </span>
                  {r.is_favourite && <span className={s.favMark}>★</span>}
                </button>
              ) : null,
            )}
          </div>
          {error && <p className={s.error}>{error}</p>}
        </div>
      )}

      {step > n && (
        <div className={s.thanks}>
          <p>
            Your reviews are in. The awards are worked out at the reveal, and every team gets its feedback then.
          </p>
          <div className="flex gap-3 flex-wrap" style={{ marginTop: 12 }}>
            <button type="button" className={ui.ghostBtn} onClick={() => go(0)}>
              Look over your answers
            </button>
            <button type="button" className={ui.textBtn} onClick={() => setStep(n)}>
              Change your favourite
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function pick(r: MyReview | undefined): Partial<MyReview> {
  if (!r) return {};
  return { score_problem: r.score_problem, score_works: r.score_works, score_use: r.score_use, strength: r.strength, suggestion: r.suggestion };
}
