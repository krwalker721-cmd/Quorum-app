"use client";

import { useMemo, useState } from "react";
import { Btn, Card, ErrorLine, Kicker, send } from "../../ui";
import { askConfirm } from "../../dialog";
import { MILESTONES, TIME_FIELDS, labelFor, quickSchedule, timelineErrors, type Timeline } from "@/lib/hackathons/timeline";
import { formatNy, nyInputToUtc, nyZoneLabel, utcToNyInput } from "@/lib/time/newYork";
import { LOBBY_MAX_LENGTH, LOBBY_WELCOME_DEFAULT } from "@/lib/hackathons/lobby";
import type { Sprint } from "./types";

type TimeKey = (typeof TIME_FIELDS)[number];

const HOUR = 3_600_000;

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono lowercase text-[0.65rem] text-text-muted">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="block font-mono text-[0.6rem] text-text-faint mt-1">{hint}</span>}
    </label>
  );
}

/** Create a Sprint (sprint = null) or edit one. Times are typed in New York time. */
export default function SprintForm({ sprint, onSaved }: { sprint: Sprint | null; onSaved: (id: string) => void }) {
  const [title, setTitle] = useState(sprint?.title ?? "");
  const [slug, setSlug] = useState(sprint?.slug ?? "");
  const [tagline, setTagline] = useState(sprint?.tagline ?? "");
  const [theme, setTheme] = useState(sprint?.theme_hidden ?? "");
  const [rules, setRules] = useState(sprint?.rules ?? "");
  const [maxSize, setMaxSize] = useState(String(sprint?.max_team_size ?? 4));
  const [minSize, setMinSize] = useState(String(sprint?.min_team_size ?? 1));
  const [inApp, setInApp] = useState(sprint?.show_countdown_in_app ?? true);
  const [onLanding, setOnLanding] = useState(sprint?.show_countdown_on_landing ?? true);
  const [headline, setHeadline] = useState(sprint?.countdown_headline_override ?? "");
  // A new Sprint starts with the default welcome; blank hides it.
  const [welcome, setWelcome] = useState(sprint ? sprint.lobby_welcome ?? "" : LOBBY_WELCOME_DEFAULT);
  const [times, setTimes] = useState<Record<TimeKey, string>>(
    () => Object.fromEntries(TIME_FIELDS.map((f) => [f, utcToNyInput(sprint?.[f] ?? null)])) as Record<TimeKey, string>,
  );
  const [kickoff, setKickoff] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every typed time, read as New York time.
  const parsed = useMemo(() => {
    const iso: Timeline = {};
    const problems: string[] = [];
    const notes: string[] = [];
    for (const f of TIME_FIELDS) {
      if (!times[f]) {
        iso[f] = null;
        continue;
      }
      const r = nyInputToUtc(times[f]);
      if (!r.ok) problems.push(`${labelFor(f)}: ${r.error}`);
      else {
        iso[f] = r.iso;
        if (r.ambiguous) notes.push(`${labelFor(f)} falls in the repeated hour when the clocks go back; read as ${formatNy(r.iso)}.`);
      }
    }
    return { iso, problems: [...problems, ...timelineErrors(iso)], notes };
  }, [times]);

  function fillFromKickoff() {
    const r = nyInputToUtc(kickoff);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const s = quickSchedule(r.iso);
    setTimes((t) => ({ ...t, ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, utcToNyInput(v)])) }));
    setError(null);
  }

  async function save() {
    setError(null);
    if (parsed.problems.length) {
      setError(parsed.problems.join(" "));
      return;
    }

    // Safety: a change to a time that's under an hour away, or has already
    // passed, needs a second look.
    if (sprint) {
      const now = Date.now();
      const risky = TIME_FIELDS.filter((f) => {
        const before = sprint[f] ? new Date(sprint[f]!).getTime() : null;
        const after = parsed.iso[f] ? new Date(parsed.iso[f]!).getTime() : null;
        if (before !== null && after !== null && Math.floor(before / 60_000) === Math.floor(after / 60_000)) return false;
        if (before === after) return false;
        return (before !== null && before <= now + HOUR) || (after !== null && after <= now + HOUR);
      });
      if (risky.length) {
        const lines = risky.map((f) => `• ${labelFor(f)}: ${formatNy(sprint[f])} → ${formatNy(parsed.iso[f])}`);
        const live = sprint.state === "live" || sprint.state === "judging" || sprint.state === "paused";
        if (
          !(await askConfirm(
            `These times are under an hour away or already under way:\n\n${lines.join("\n")}\n\n` +
              (live ? "The Sprint is running: members will see this immediately.\n\n" : "") +
              "Save anyway?",
            { ok: "save anyway" },
          ))
        ) {
          return;
        }
      }
    }

    const all: Record<string, unknown> = {
      title,
      slug: slug || null,
      tagline,
      theme_hidden: theme,
      rules,
      max_team_size: Number(maxSize),
      min_team_size: Number(minSize),
      show_countdown_in_app: inApp,
      show_countdown_on_landing: onLanding,
      countdown_headline_override: headline,
      lobby_welcome: welcome,
      ...parsed.iso,
    };
    // Editing: send only what changed, so a stale form can't overwrite a
    // change someone else made meanwhile.
    const body = sprint
      ? Object.fromEntries(
          Object.entries(all).filter(([k, v]) => {
            const before = (sprint as unknown as Record<string, unknown>)[k];
            if ((TIME_FIELDS as string[]).includes(k)) {
              // To the minute: the input can't show seconds, so seconds alone
              // never count as a change.
              const min = (x: unknown) => (x ? Math.floor(new Date(x as string).getTime() / 60_000) : null);
              return min(before) !== min(v);
            }
            const norm = (x: unknown) => (x === "" || x === undefined ? null : x);
            return norm(before) !== norm(v);
          }),
        )
      : all;
    if (sprint && Object.keys(body).length === 0) {
      onSaved(sprint.id);
      return;
    }
    setBusy(true);
    const r = sprint
      ? await send(`/api/admin/hackathons/${sprint.id}`, body, "PATCH")
      : await send("/api/admin/hackathons", body);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "Couldn't save.");
      return;
    }
    onSaved(sprint?.id ?? (r.data as { id: string }).id);
  }

  return (
    <div className="space-y-4">
      <Card>
        <Kicker>basics</Kicker>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Night Owls" />
          </Field>
          <Field label="slug" hint="Blank: sprint-<number>.">
            <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="sprint-1" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="tagline">
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="theme (hidden until kickoff)" hint="Nobody but admins can read this before kickoff, not even through the API.">
              <textarea rows={2} value={theme} onChange={(e) => setTheme(e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="rules (markdown)">
              <textarea rows={5} value={rules} onChange={(e) => setRules(e.target.value)} />
            </Field>
          </div>
          <Field label="max team size">
            <input type="number" min={1} max={12} value={maxSize} onChange={(e) => setMaxSize(e.target.value)} />
          </Field>
          <Field label="min team size">
            <input type="number" min={1} max={12} value={minSize} onChange={(e) => setMinSize(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Kicker className="mb-0">times</Kicker>
          <span className="font-mono text-[0.7rem]" style={{ color: "#f59e0b" }}>
            New York time · {nyZoneLabel(parsed.iso.starts_at ?? null)}
          </span>
        </div>
        <p className="font-mono text-[0.65rem] text-text-faint mt-1 mb-3">
          Stored in UTC; members see them in their own time zone.
        </p>

        <div className="flex flex-wrap items-end gap-2 mb-4 p-3" style={{ border: "1px dashed var(--border)" }}>
          <div className="flex-1 min-w-[200px]">
            <Field label="quick schedule: kickoff">
              <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
            </Field>
          </div>
          <Btn onClick={fillFromKickoff} disabled={!kickoff}>
            fill the rest
          </Btn>
          <p className="basis-full font-mono text-[0.6rem] text-text-faint">
            Registration opens 7 days before, team lock 1 hour before, deadline 48h after kickoff, judging ends 48h
            after the deadline, reveal when judging ends. All still editable.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIME_FIELDS.map((f) => (
            <Field
              key={f}
              label={f === "lobby_closes_at" ? "lobby closes (optional; blank = stays open)" : labelFor(f).toLowerCase()}
              hint={parsed.iso[f] ? formatNy(parsed.iso[f]) : f === "lobby_closes_at" ? "stays open" : "not set (fine for a draft)"}
            >
              <div className="flex gap-2">
                <input type="datetime-local" value={times[f]} onChange={(e) => setTimes((t) => ({ ...t, [f]: e.target.value }))} />
                {times[f] && (
                  <button
                    type="button"
                    onClick={() => setTimes((t) => ({ ...t, [f]: "" }))}
                    className="font-mono text-[0.65rem] text-text-faint hover:text-text-primary px-1"
                    aria-label={`clear ${labelFor(f)}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            </Field>
          ))}
        </div>
        {parsed.problems.length > 0 && (
          <div className="mt-3 space-y-1">
            {parsed.problems.map((p) => (
              <ErrorLine key={p}>{p}</ErrorLine>
            ))}
          </div>
        )}
        {parsed.notes.map((n) => (
          <p key={n} className="font-mono text-[0.65rem] mt-2" style={{ color: "#f59e0b" }}>
            {n}
          </p>
        ))}
        {!MILESTONES.every((m) => parsed.iso[m.key]) && (
          <p className="font-mono text-[0.65rem] text-text-faint mt-3">A Sprint needs all six dates before it can be published.</p>
        )}
      </Card>

      <Card>
        <Kicker>countdown</Kicker>
        <p className="font-mono text-[0.65rem] text-text-faint mb-3">
          Always counts to this Sprint&apos;s real times (registration, kickoff, deadline, reveal). To move it, move the
          times.
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={inApp} onChange={(e) => setInApp(e.target.checked)} /> show in the app
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={onLanding} onChange={(e) => setOnLanding(e.target.checked)} /> show on the landing page
          </label>
          <Field label="headline override (optional)" hint="Blank: the Sprint's title and the milestone.">
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <Kicker>lobby</Kicker>
        <Field label="welcome note (pinned at the top)" hint={`Blank: no welcome note. ${welcome.length} / ${LOBBY_MAX_LENGTH}`}>
          <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={3} maxLength={LOBBY_MAX_LENGTH} />
        </Field>
      </Card>

      <div className="flex items-center gap-3">
        <Btn variant="primary" onClick={save} disabled={busy || !title.trim()}>
          {busy ? "saving…" : sprint ? "save changes" : "create draft"}
        </Btn>
        {!sprint && <span className="font-mono text-[0.65rem] text-text-faint">Drafts are visible only to admins.</span>}
      </div>
      <ErrorLine>{error}</ErrorLine>
    </div>
  );
}
