"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "../../lib/api";
import { Btn, Card, ErrorLine, Kicker, send, when } from "../../ui";
import { formatNy } from "@/lib/time/newYork";
import { AWARD_LABEL, NAMED_AWARDS, RUBRIC, type AwardType, type Averages, type ScoreKey } from "@/lib/hackathons/judging";

// Judging (Phase 9): who has scored what, every complete submission's
// averages (a ranking for admins only), and the award board. Finalizing the
// awards makes them public at the reveal and locks them (migration 031).

type JudgeRow = { id: string; user_id: string | null; name: string | null; email: string | null; accepted_at: string | null; scored: number };
type JudgeScore = Record<ScoreKey, number> & { judge_id: string; judge_name: string; notes: string | null; updated_at: string };
type Project = {
  submission_id: string;
  project_name: string | null;
  tagline: string | null;
  team: { name: string; slug: string; emblem: string | null; color: string | null } | null;
  averages: Averages;
  count: number;
  spread: number | null;
  scores: JudgeScore[];
};
type AwardRow = { id: string; award_type: AwardType; custom_label: string | null; citation: string | null; submission_id: string };
type Data = {
  sprint: {
    id: string;
    number: number;
    state: string | null;
    phase: string | null;
    ends_at: string | null;
    judging_ends_at: string | null;
    reveal_at: string | null;
    awards_finalized_at: string | null;
    awards_finalized_by: string | null;
  };
  judges: JudgeRow[];
  drafts: number;
  no_submission: number;
  projects: Project[];
  awards: AwardRow[];
};

type SortKey = ScoreKey | "overall" | "count" | "spread" | "name";
const COLUMNS: { key: SortKey; label: string }[] = [
  ...RUBRIC.map((r) => ({ key: r.key as SortKey, label: r.label.toLowerCase().slice(0, 7) })),
  { key: "overall", label: "overall" },
  { key: "count", label: "judges" },
  { key: "spread", label: "spread" },
];
const fmt = (n: number | null) => (n === null ? "—" : n.toFixed(1));
const awardName = (a: Pick<AwardRow, "award_type" | "custom_label">) => (a.award_type === "custom" ? a.custom_label ?? "award" : AWARD_LABEL[a.award_type]);

export default function Judging({ sprintId }: { sprintId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const path = `/api/admin/hackathons/${sprintId}/judging`;

  const load = useCallback(async () => {
    const res = await adminFetch(path);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json.error ?? "Couldn't load judging.");
    else setData(json);
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const r = await send(path, body);
    setBusy(false);
    if (!r.ok) setError(r.error ?? "That didn't work.");
    await load();
    return r.ok;
  }

  if (!data) return error ? <ErrorLine>{error}</ErrorLine> : <p className="font-mono text-xs text-text-faint">loading…</p>;

  const { sprint, judges, projects, awards } = data;
  const finalized = Boolean(sprint.awards_finalized_at);
  const accepted = judges.filter((j) => j.user_id && j.accepted_at);
  const unfinished = accepted.filter((j) => j.scored < projects.length);
  const unscored = projects.filter((p) => p.count === 0);
  const now = Date.now();
  const opened = sprint.ends_at !== null && now >= Date.parse(sprint.ends_at);
  const revealMs = sprint.reveal_at ? Date.parse(sprint.reveal_at) : null;
  const revealed = sprint.phase === "revealed";

  async function finalize() {
    const empty = NAMED_AWARDS.filter((n) => !awards.some((a) => a.award_type === n.type)).map((n) => AWARD_LABEL[n.type]);
    const scoringOpen = sprint.judging_ends_at !== null && now < Date.parse(sprint.judging_ends_at);
    const warnings = [
      unfinished.length && `${unfinished.map((j) => j.name ?? j.email).join(", ")} ${unfinished.length === 1 ? "hasn't" : "haven't"} scored every project.`,
      unscored.length && `${unscored.length} ${unscored.length === 1 ? "project has" : "projects have"} no scores at all.`,
      empty.length && `No winner yet for: ${empty.join(", ")}.`,
      awards.length === 0 && "There are no awards at all.",
      scoringOpen && "Scoring is still open, so judges can still change scores.",
    ].filter(Boolean);
    const msg =
      `Finalize ${awards.length} award${awards.length === 1 ? "" : "s"}?\n\n` +
      (revealed ? "The Sprint is revealed, so they appear on the public page right away." : "They become public at the reveal.") +
      " The board locks until you reopen it." +
      (warnings.length ? `\n\nBefore you do:\n• ${warnings.join("\n• ")}` : "");
    if (window.confirm(msg)) await run({ op: "finalize" });
  }

  async function reopen() {
    const msg = revealed
      ? "Reopen the awards?\n\nThe Sprint is revealed, so they disappear from the public page until you finalize again."
      : "Reopen the awards so you can change them?";
    if (window.confirm(msg)) await run({ op: "unfinalize" });
  }

  return (
    <div className="space-y-4">
      {/* Where things stand */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm text-text-primary">
              {!opened
                ? `scoring opens at the deadline (${formatNy(sprint.ends_at)})`
                : sprint.judging_ends_at && now < Date.parse(sprint.judging_ends_at)
                  ? `scoring is open until ${formatNy(sprint.judging_ends_at)}`
                  : "scoring is closed"}
            </p>
            <p className="font-mono text-[0.65rem] text-text-faint">reveal: {formatNy(sprint.reveal_at)} (new york)</p>
            <p className="font-mono text-[0.7rem]" style={{ color: finalized ? "#22c55e" : "#f59e0b" }}>
              {finalized
                ? `awards finalized ${when(sprint.awards_finalized_at!)}${sprint.awards_finalized_by ? ` by ${sprint.awards_finalized_by}` : ""}`
                : "awards not finalized: nobody outside the admins sees them"}
            </p>
            {!finalized && revealed && (
              <p className="font-mono text-[0.7rem]" style={{ color: "#f87171" }}>
                the sprint is revealed and its awards aren&apos;t finalized, so the public page shows none.
              </p>
            )}
            {!finalized && !revealed && revealMs !== null && revealMs - now < 24 * 3_600_000 && revealMs > now && (
              <p className="font-mono text-[0.7rem]" style={{ color: "#f87171" }}>
                the reveal is less than a day away. finalize the awards before then, or the page will show none.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Btn onClick={load} disabled={busy}>
              refresh
            </Btn>
            {finalized ? (
              <Btn variant="danger" onClick={reopen} disabled={busy}>
                reopen awards
              </Btn>
            ) : (
              <Btn variant="primary" onClick={finalize} disabled={busy || !opened || sprint.state === "cancelled"}>
                finalize awards
              </Btn>
            )}
          </div>
        </div>
        <ErrorLine>{error}</ErrorLine>
      </Card>

      <Judges judges={judges} total={projects.length} />
      <Results sprintNumber={sprint.number} projects={projects} awards={awards} drafts={data.drafts} noSubmission={data.no_submission} />
      {opened && (
        <AwardBoard projects={projects} awards={awards} finalized={finalized} busy={busy} run={run} />
      )}
    </div>
  );
}

function Judges({ judges, total }: { judges: JudgeRow[]; total: number }) {
  return (
    <Card>
      <Kicker>judges</Kicker>
      {judges.length === 0 ? (
        <p className="font-mono text-xs text-text-faint">no judges yet: add them in the judges tab</p>
      ) : (
        <ul className="space-y-2">
          {judges.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-text-primary break-words">{j.name ?? j.email}</span>
              <span className="font-mono text-[0.65rem]" style={{ color: !j.user_id || !j.accepted_at ? "#f59e0b" : j.scored >= total && total > 0 ? "#22c55e" : "var(--text-secondary)" }}>
                {!j.user_id ? "email invite · no account yet" : !j.accepted_at ? "hasn't accepted yet" : `scored ${j.scored} of ${total}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Results({
  sprintNumber,
  projects,
  awards,
  drafts,
  noSubmission,
}: {
  sprintNumber: number;
  projects: Project[];
  awards: AwardRow[];
  drafts: number;
  noSubmission: number;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "overall", desc: true });
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const val = (p: Project): number | string =>
      sort.key === "name" ? (p.project_name ?? "").toLowerCase() : sort.key === "count" ? p.count : sort.key === "spread" ? p.spread ?? -1 : p.averages[sort.key] ?? -1;
    return [...projects].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -c : c;
    });
  }, [projects, sort]);

  const header = (key: SortKey, label: string, align = "text-right") => (
    <th key={key} className={`px-2 py-2 ${align}`}>
      <button type="button" onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "name" }))} className="lowercase hover:text-text-primary">
        {label}
        {sort.key === key ? (sort.desc ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  return (
    <Card>
      <Kicker>results · admins only</Kicker>
      <p className="font-mono text-[0.65rem] text-text-faint mb-3">
        complete submissions only.
        {drafts > 0 && ` ${drafts} draft${drafts === 1 ? "" : "s"} not judged.`}
        {noSubmission > 0 && ` ${noSubmission} team${noSubmission === 1 ? "" : "s"} submitted nothing.`} click a row for each judge&apos;s scores and notes.
      </p>
      {projects.length === 0 ? (
        <p className="font-mono text-xs text-text-faint">nothing to judge yet</p>
      ) : (
        <div className="overflow-x-auto border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="font-mono text-[0.6rem] text-text-faint">
                {header("name", "project", "text-left")}
                {COLUMNS.map((c) => header(c.key, c.label))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const held = awards.filter((a) => a.submission_id === p.submission_id);
                return (
                  <Fragment key={p.submission_id}>
                    <tr
                      onClick={() => setOpen((o) => (o === p.submission_id ? null : p.submission_id))}
                      className="border-t cursor-pointer hover:bg-white/[0.03]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-2 py-2">
                        <span className="text-text-primary">{p.project_name ?? "untitled"}</span>
                        <span className="font-mono text-[0.6rem] text-text-faint ml-2">{p.team?.name}</span>
                        {held.map((a) => (
                          <span key={a.id} className="font-mono text-[0.55rem] ml-2 px-1 py-0.5" style={{ color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)" }}>
                            {awardName(a).toLowerCase()}
                          </span>
                        ))}
                      </td>
                      {COLUMNS.map((c) => (
                        <td
                          key={c.key}
                          className="px-2 py-2 font-mono text-right"
                          style={{
                            color: c.key === "overall" ? "var(--text-primary)" : c.key === "count" && p.count === 0 ? "#f87171" : "var(--text-secondary)",
                          }}
                        >
                          {c.key === "count" ? p.count : c.key === "spread" ? fmt(p.spread) : fmt(p.averages[c.key as ScoreKey | "overall"])}
                        </td>
                      ))}
                    </tr>
                    {open === p.submission_id && (
                      <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                        <td colSpan={COLUMNS.length + 1} className="px-3 py-3">
                          {p.tagline && <p className="text-xs text-text-secondary mb-2">{p.tagline}</p>}
                          {p.scores.length === 0 ? (
                            <p className="font-mono text-xs text-text-faint">no judge has scored this yet</p>
                          ) : (
                            <ul className="space-y-2">
                              {p.scores.map((s) => (
                                <li key={s.judge_id}>
                                  <p className="font-mono text-[0.7rem] text-text-secondary">
                                    {s.judge_name} · {RUBRIC.map((r) => `${r.label.toLowerCase()} ${s[r.key]}`).join(" · ")}
                                    <span className="text-text-faint"> · {when(s.updated_at)}</span>
                                  </p>
                                  {s.notes && <p className="text-xs text-text-primary whitespace-pre-wrap mt-0.5">{s.notes}</p>}
                                </li>
                              ))}
                            </ul>
                          )}
                          {p.team && (
                            <a
                              href={`/hackathon/${sprintNumber}/team/${p.team.slug}/submission`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[0.65rem] text-text-faint hover:text-text-primary inline-block mt-2"
                            >
                              open submission ↗
                            </a>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function AwardBoard({
  projects,
  awards,
  finalized,
  busy,
  run,
}: {
  projects: Project[];
  awards: AwardRow[];
  finalized: boolean;
  busy: boolean;
  run: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const byId = new Map(projects.map((p) => [p.submission_id, p]));
  const label = (id: string) => {
    const p = byId.get(id);
    return p ? `${p.project_name ?? "untitled"} (${p.team?.name ?? "?"})` : "a project";
  };
  const othersHeld = (submissionId: string, exceptId?: string) =>
    awards.filter((a) => a.submission_id === submissionId && a.id !== exceptId).map(awardName);
  const locked = finalized || busy;

  return (
    <Card>
      <Kicker>awards</Kicker>
      <p className="font-mono text-[0.65rem] text-text-faint mb-3">
        {finalized
          ? "finalized: reopen the awards (above) to change them."
          : "one winner per named award; custom awards as many as you like. suggestions come from the judges' averages. nothing here is public until you finalize."}
      </p>

      <div className="space-y-3">
        {NAMED_AWARDS.map((slot) => {
          const current = awards.find((a) => a.award_type === slot.type) ?? null;
          const ranked = [...projects]
            .filter((p) => p.averages[slot.basis] !== null)
            .sort((a, b) => (b.averages[slot.basis] ?? 0) - (a.averages[slot.basis] ?? 0))
            .slice(0, 3);
          return (
            <div key={slot.type} className="border p-3" style={{ borderColor: current ? "rgba(245,158,11,0.35)" : "var(--border)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-text-primary">{AWARD_LABEL[slot.type]}</p>
                <p className="font-mono text-[0.6rem] text-text-faint">suggested by {slot.basisLabel} average</p>
              </div>
              {current ? (
                <AwardWinner
                  key={current.id + (current.citation ?? "")}
                  award={current}
                  label={label(current.submission_id)}
                  alsoHolds={othersHeld(current.submission_id, current.id)}
                  locked={locked}
                  run={run}
                />
              ) : (
                <p className="font-mono text-[0.7rem] mt-1" style={{ color: "#f59e0b" }}>
                  no winner yet
                </p>
              )}
              {!finalized && (
                <div className="mt-2 space-y-1">
                  {ranked.map((p, i) => {
                    const holds = othersHeld(p.submission_id, current?.id);
                    const isWinner = current?.submission_id === p.submission_id;
                    return (
                      <div key={p.submission_id} className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[0.65rem] text-text-faint w-4">{i + 1}.</span>
                        <span className="text-xs text-text-secondary">
                          {p.project_name ?? "untitled"} <span className="font-mono text-text-faint">{fmt(p.averages[slot.basis])}</span>
                        </span>
                        {holds.length > 0 && (
                          <span className="font-mono text-[0.6rem]" style={{ color: "#f59e0b" }}>
                            already has: {holds.join(", ").toLowerCase()}
                          </span>
                        )}
                        {!isWinner && (
                          <Btn
                            className="!py-1"
                            disabled={locked}
                            onClick={() => {
                              if (holds.length && !window.confirm(`${p.project_name ?? "This project"} already has ${holds.join(", ")}. Give it ${AWARD_LABEL[slot.type]} too?`)) return;
                              run({ op: "award_set", award_type: slot.type, submission_id: p.submission_id, citation: current?.citation ?? null });
                            }}
                          >
                            {current ? "make winner" : "give"}
                          </Btn>
                        )}
                      </div>
                    );
                  })}
                  <PickAny
                    projects={projects}
                    exclude={current?.submission_id}
                    disabled={locked}
                    onPick={(id) => run({ op: "award_set", award_type: slot.type, submission_id: id, citation: current?.citation ?? null })}
                  />
                </div>
              )}
            </div>
          );
        })}

        <div className="border p-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm text-text-primary">Custom awards</p>
          {awards.filter((a) => a.award_type === "custom").length === 0 && <p className="font-mono text-[0.7rem] text-text-faint mt-1">none</p>}
          {awards
            .filter((a) => a.award_type === "custom")
            .map((a) => (
              <div key={a.id} className="mt-2">
                <p className="font-mono text-[0.7rem] text-text-secondary">{a.custom_label}</p>
                <AwardWinner award={a} label={label(a.submission_id)} alsoHolds={othersHeld(a.submission_id, a.id)} locked={locked} run={run} />
              </div>
            ))}
          {!finalized && <CustomAwardForm projects={projects} disabled={locked} run={run} />}
        </div>
      </div>
    </Card>
  );
}

function AwardWinner({
  award,
  label,
  alsoHolds,
  locked,
  run,
}: {
  award: AwardRow;
  label: string;
  alsoHolds: string[];
  locked: boolean;
  run: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [citation, setCitation] = useState(award.citation ?? "");
  const changed = citation.trim() !== (award.citation ?? "");
  return (
    <div className="mt-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm" style={{ color: "#f8c56a" }}>
          → {label}
        </span>
        {alsoHolds.length > 0 && (
          <span className="font-mono text-[0.6rem]" style={{ color: "#f59e0b" }}>
            also has: {alsoHolds.join(", ").toLowerCase()}
          </span>
        )}
        {!locked && (
          <Btn className="!py-1" variant="danger" onClick={() => window.confirm(`Remove ${awardName(award)}?`) && run({ op: "award_remove", award_id: award.id })}>
            remove
          </Btn>
        )}
      </div>
      {locked ? (
        award.citation && <p className="text-xs text-text-secondary italic">“{award.citation}”</p>
      ) : (
        <div className="flex gap-2">
          <input value={citation} maxLength={280} onChange={(e) => setCitation(e.target.value)} placeholder="Citation (optional): one line on why it won" />
          {changed && (
            <Btn className="!py-1" onClick={() => run({ op: "award_citation", award_id: award.id, citation })}>
              save
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}

function PickAny({ projects, exclude, disabled, onPick }: { projects: Project[]; exclude?: string; disabled: boolean; onPick: (id: string) => void }) {
  const options = projects.filter((p) => p.submission_id !== exclude);
  if (options.length === 0) return null;
  return (
    <select
      value=""
      disabled={disabled}
      onChange={(e) => e.target.value && onPick(e.target.value)}
      className="font-mono text-[0.7rem] mt-1"
      style={{ maxWidth: 320 }}
    >
      <option value="">or pick any project…</option>
      {options.map((p) => (
        <option key={p.submission_id} value={p.submission_id}>
          {p.project_name ?? "untitled"} ({p.team?.name ?? "?"})
        </option>
      ))}
    </select>
  );
}

function CustomAwardForm({ projects, disabled, run }: { projects: Project[]; disabled: boolean; run: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [project, setProject] = useState("");
  const [citation, setCitation] = useState("");
  return (
    <div className="mt-3 space-y-2">
      <Kicker className="!mb-1">add a custom award</Kicker>
      <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Award name, e.g. Best demo video" />
      <select value={project} onChange={(e) => setProject(e.target.value)} className="font-mono text-[0.7rem]">
        <option value="">choose a project…</option>
        {projects.map((p) => (
          <option key={p.submission_id} value={p.submission_id}>
            {p.project_name ?? "untitled"} ({p.team?.name ?? "?"})
          </option>
        ))}
      </select>
      <input value={citation} maxLength={280} onChange={(e) => setCitation(e.target.value)} placeholder="Citation (optional)" />
      <Btn
        variant="primary"
        disabled={disabled || !name.trim() || !project}
        onClick={async () => {
          if (await run({ op: "award_custom", custom_label: name, submission_id: project, citation })) {
            setName("");
            setProject("");
            setCitation("");
          }
        }}
      >
        give award
      </Btn>
    </div>
  );
}
