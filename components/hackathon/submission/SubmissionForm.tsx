"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ui from "@/components/ui/sleek.module.css";
import LocalTime from "@/components/hackathon/LocalTime";
import ProjectShowcase, { type ShowcasePerson, type ShowcaseTeam } from "@/components/hackathon/showcase/ProjectShowcase";
import DeadlineWarning from "./DeadlineWarning";
import Screenshots from "./Screenshots";
import TagInput from "./TagInput";
import { realtimeDb, sprintDb } from "@/lib/hackathons/actions";
import { approxServerNow } from "@/lib/useServerNow";
import {
  LABEL_RESET,
  LIMITS,
  SUBMISSION_COLUMNS,
  TEXT_KEYS,
  fieldsOf,
  isUrl,
  missing,
  type FieldKey,
  type SubmissionFields,
  type SubmissionRow,
} from "@/lib/hackathons/submission";

// The team's submission (Phase 8). Any member edits it from kickoff to the
// deadline; it autosaves a moment after typing stops, sending only the
// fields you changed, so two teammates on different fields never overwrite
// each other, and their changes appear here live in fields you haven't
// touched. The database decides what counts as submitted (is_complete) and
// refuses every write after the deadline (migrations 020, 030); this page
// saves whatever is pending a few seconds before, locks at the deadline on
// the server's clock, and if a save still loses the race it says so and
// offers your unsaved text back.

const SAVE_AFTER_MS = 1500;
const FLUSH_BEFORE_DEADLINE_MS = 5000;

const LABEL: Record<FieldKey, string> = {
  project_name: "Project name",
  tagline: "Tagline",
  problem: "Problem",
  description: "Description",
  demo_url: "Demo URL",
  repo_url: "Repo URL",
  video_url: "Video URL",
  screenshots: "Screenshots",
  built_with: "Built with",
};

const URL_KEYS: FieldKey[] = ["demo_url", "repo_url", "video_url"];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Status = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

function Field({
  label,
  hint,
  count,
  max,
  error,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  count?: number;
  max?: number;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block" style={LABEL_RESET}>
      <span className="flex items-baseline justify-between gap-3" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
        {max !== undefined && count !== undefined && count > max * 0.8 && (
          <span style={{ fontSize: 11, color: count > max ? "#f87171" : "var(--text-muted)" }}>
            {count} / {max}
          </span>
        )}
      </span>
      {children}
      {error ? (
        <span style={{ display: "block", fontSize: 11.5, color: "#f87171", marginTop: 5 }}>{error}</span>
      ) : hint ? (
        <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", marginTop: 5 }}>{hint}</span>
      ) : null}
    </label>
  );
}

export default function SubmissionForm({
  sprint,
  team,
  members,
  everyone,
  initial,
  initialUrls,
  writable,
  closedReason,
  roomHref,
}: {
  sprint: { id: string; number: number; endsAt: string | null; live: boolean };
  team: ShowcaseTeam & { id: string };
  members: ShowcasePerson[];
  /** Members plus whoever last edited it, for "last edited by". */
  everyone: ShowcasePerson[];
  initial: SubmissionRow | null;
  initialUrls: Record<string, string>;
  writable: boolean;
  closedReason: string | null;
  roomHref: string;
}) {
  const [row, setRow] = useState<SubmissionRow | null>(initial);
  const [fields, setFields] = useState<SubmissionFields>(() => fieldsOf(initial));
  const [dirtyKeys, setDirtyKeys] = useState<FieldKey[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [locked, setLocked] = useState(!writable);
  const [lost, setLost] = useState<FieldKey[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>(initialUrls);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const rowRef = useRef(row);
  const fieldsRef = useRef(fields);
  const dirty = useRef(new Set<FieldKey>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const again = useRef(false);
  const lockedRef = useRef(locked);
  rowRef.current = row;
  fieldsRef.current = fields;
  lockedRef.current = locked;

  const names = useMemo(() => new Map(everyone.map((m) => [m.id, m.full_name ?? m.username ?? "Founder"])), [everyone]);

  // The server says it's closed (deadline, pause): lock.
  useEffect(() => {
    if (!writable) setLocked(true);
  }, [writable]);

  const markDirty = (keys: FieldKey[]) => {
    keys.forEach((k) => dirty.current.add(k));
    setDirtyKeys([...dirty.current]);
  };

  /** Sends every changed field that's valid. Safe to call any time. */
  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (saving.current) {
      again.current = true;
      return;
    }
    const f = fieldsRef.current;
    const keys = [...dirty.current].filter((k) => !URL_KEYS.includes(k) || f[k] === "" || isUrl(f[k] as string));
    if (keys.length === 0) return;

    const patch: Record<string, unknown> = {};
    for (const k of keys) {
      const v = f[k];
      patch[k] = (TEXT_KEYS as readonly string[]).includes(k) ? ((v as string).trim() === "" ? null : (v as string).trim()) : v;
    }
    const sent = Object.fromEntries(keys.map((k) => [k, f[k]])) as Partial<SubmissionFields>;

    saving.current = true;
    setStatus({ kind: "saving" });
    const db = sprintDb();
    let res = rowRef.current
      ? await db.from("hackathon_submissions").update(patch).eq("team_id", team.id).select(SUBMISSION_COLUMNS).single()
      : await db
          .from("hackathon_submissions")
          .insert({ team_id: team.id, hackathon_id: sprint.id, ...patch })
          .select(SUBMISSION_COLUMNS)
          .single();
    // A teammate started it a moment before us: update theirs instead.
    if (!rowRef.current && res.error?.code === "23505") {
      res = await db.from("hackathon_submissions").update(patch).eq("team_id", team.id).select(SUBMISSION_COLUMNS).single();
    }
    saving.current = false;

    if (res.error || !res.data) {
      const e = res.error;
      if (e?.hint === "submissions_closed" || e?.hint === "sprint_frozen" || /deadline has passed|frozen/i.test(e?.message ?? "")) {
        setLocked(true);
        setLost([...dirty.current]);
        setStatus({ kind: "error", message: e?.message ?? "Submissions are closed." });
      } else {
        setStatus({ kind: "error", message: e?.message ?? "That didn't save. It'll try again when you next type." });
      }
      return;
    }

    const saved = res.data as unknown as SubmissionRow;
    setRow(saved);
    for (const k of keys) {
      if (same(fieldsRef.current[k], sent[k])) dirty.current.delete(k);
    }
    setDirtyKeys([...dirty.current]);
    setStatus({ kind: "saved" });
    if (again.current || dirty.current.size > 0) {
      again.current = false;
      timer.current = setTimeout(() => void save(), SAVE_AFTER_MS);
    }
  }, [sprint.id, team.id]);

  function set<K extends FieldKey>(k: K, v: SubmissionFields[K], now = false) {
    if (lockedRef.current) return;
    setFields((f) => {
      const next = { ...f, [k]: v };
      fieldsRef.current = next;
      return next;
    });
    markDirty([k]);
    setStatus((s) => (s.kind === "saving" ? s : { kind: "idle" }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), now ? 0 : SAVE_AFTER_MS);
  }

  // Teammates' saves, live: take every field you haven't changed yourself.
  useEffect(() => {
    let stopped = false;
    let cleanup = () => {};
    (async () => {
      const db = await realtimeDb();
      if (stopped) return;
      const channel = db
        .channel(`submission-${team.id}`)
        .on(
          "postgres_changes" as any,
          { event: "*", schema: "public", table: "hackathon_submissions", filter: `team_id=eq.${team.id}` },
          (p: { eventType: string; new: SubmissionRow }) => {
            if (p.eventType === "DELETE" || !p.new?.id) return;
            const incoming = { ...(rowRef.current ?? {}), ...p.new } as SubmissionRow;
            setRow(incoming);
            const theirs = fieldsOf(incoming);
            setFields((f) => {
              const next = { ...f };
              (Object.keys(theirs) as FieldKey[]).forEach((k) => {
                if (!dirty.current.has(k)) (next as Record<FieldKey, unknown>)[k] = theirs[k];
              });
              fieldsRef.current = next;
              return next;
            });
          },
        )
        .subscribe();
      cleanup = () => {
        db.removeChannel(channel);
      };
    })();
    return () => {
      stopped = true;
      cleanup();
    };
  }, [team.id]);

  // Signed URLs for screenshots a teammate added.
  useEffect(() => {
    const need = fields.screenshots.filter((p) => !urls[p]);
    if (need.length === 0) return;
    sprintDb()
      .storage.from("hackathon-submissions")
      .createSignedUrls(need, 3600)
      .then(({ data }) => {
        if (!data) return;
        const fresh: Record<string, string> = Object.fromEntries(
          data.filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]),
        );
        setUrls((u) => ({ ...u, ...fresh }));
      });
  }, [fields.screenshots, urls]);

  // The deadline, on the server's clock: save what's pending just before,
  // then lock.
  useEffect(() => {
    if (!sprint.endsAt || !writable) return;
    const end = Date.parse(sprint.endsAt);
    const now = approxServerNow();
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (end - now > FLUSH_BEFORE_DEADLINE_MS) {
      timers.push(setTimeout(() => void save(), end - now - FLUSH_BEFORE_DEADLINE_MS));
    }
    if (end > now && end - now < 2_147_000_000) {
      timers.push(
        setTimeout(() => {
          setLocked(true);
          if (dirty.current.size > 0) void save();
        }, end - now),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [sprint.endsAt, writable, save]);

  // Leaving with unsaved changes: save them on the way, and warn.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current.size === 0) return;
      void save();
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [save]);

  async function copyUnsaved() {
    const keys = lost ?? [];
    const text = keys
      .filter((k) => (TEXT_KEYS as readonly string[]).includes(k) || k === "built_with")
      .map((k) => `${LABEL[k]}:\n${Array.isArray(fields[k]) ? (fields[k] as string[]).join(", ") : fields[k]}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt("Copy your unsaved text:", text);
    }
  }

  const checklist = missing(fields);
  const complete = Boolean(row?.is_complete) && dirtyKeys.length === 0;
  const urlError = (k: FieldKey) => {
    const v = (fields[k] as string).trim();
    return v && !isUrl(v) ? "That doesn't look like a link. It should start with https://" : null;
  };
  const orderedUrls = fields.screenshots.map((p) => urls[p]).filter(Boolean);

  const statusText =
    status.kind === "saving"
      ? "Saving…"
      : status.kind === "error"
        ? status.message
        : dirtyKeys.length > 0
          ? "Unsaved changes"
          : row
            ? "All changes saved"
            : "Nothing saved yet";

  return (
    <div className="space-y-4">
      <DeadlineWarning endsAt={sprint.endsAt} live={sprint.live && !locked} complete={Boolean(row?.is_complete)} />

      {lost && lost.length > 0 && (
        <div
          role="alert"
          style={{ border: "1px solid rgba(248, 113, 113, 0.5)", background: "rgba(248, 113, 113, 0.08)", borderRadius: 12, padding: "12px 16px" }}
        >
          <p style={{ fontSize: 14, fontWeight: 600, color: "#fca5a5" }}>The deadline passed before your last changes saved.</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.55 }}>
            Not saved: {lost.map((k) => LABEL[k]).join(", ")}. The submission keeps what was saved before the deadline.
          </p>
          <button type="button" className={ui.softBtn} style={{ marginTop: 10 }} onClick={copyUnsaved}>
            {copied ? "Copied" : "Copy my unsaved text"}
          </button>
        </div>
      )}

      {locked && closedReason && !lost && (
        <p
          role="status"
          style={{ fontSize: 13, color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "10px 14px" }}
        >
          {closedReason}
        </p>
      )}

      {/* Where it stands */}
      <div className={ui.tile} style={{ padding: "16px 18px" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <span
              className={`${ui.chip} ${complete ? "" : ui.chipAmber}`}
              style={complete ? { color: "#4ade80", borderColor: "rgba(34, 197, 94, 0.35)", background: "rgba(34, 197, 94, 0.08)" } : undefined}
            >
              {complete ? "Submitted ✓" : "Draft"}
            </span>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
              {row ? (
                <>
                  Last edited by {row.last_edited_by ? names.get(row.last_edited_by) ?? "a former teammate" : "an admin"} ·{" "}
                  <LocalTime iso={row.updated_at} />
                </>
              ) : (
                "Nobody has started it yet."
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!locked && (
              <span aria-live="polite" style={{ fontSize: 12, color: status.kind === "error" ? "#f87171" : "var(--text-muted)" }}>
                {statusText}
              </span>
            )}
            <button type="button" className={ui.softBtn} onClick={() => setPreview(true)}>
              Preview the reveal
            </button>
          </div>
        </div>
        <ul className="grid gap-1.5" style={{ marginTop: 14, gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
          {checklist.map((c) => (
            <li key={c.key} className="flex items-center gap-2" style={{ fontSize: 13, color: c.done ? "var(--text-secondary)" : "var(--text-primary)" }}>
              <span aria-hidden style={{ color: c.done ? "#4ade80" : "#f8c56a", width: 14 }}>
                {c.done ? "✓" : "○"}
              </span>
              <span>
                {c.label}
                <span className="sr-only">{c.done ? " (done)" : " (missing)"}</span>
              </span>
            </li>
          ))}
        </ul>
        {!complete && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
            All four make it count as submitted. Until then it&rsquo;s a draft only your team sees.
          </p>
        )}
      </div>

      {/* The form */}
      <fieldset disabled={locked} className="space-y-5" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className={ui.tile} style={{ padding: "18px 18px 20px" }}>
          <div className="space-y-5">
            <Field label="Project name" count={fields.project_name.length} max={LIMITS.project_name}>
              <input
                className={`${ui.search} w-full`}
                value={fields.project_name}
                maxLength={LIMITS.project_name}
                placeholder="What's it called?"
                onChange={(e) => set("project_name", e.target.value)}
                onBlur={() => void save()}
              />
            </Field>
            <Field label="Tagline" hint="One line: what it does, for whom." count={fields.tagline.length} max={LIMITS.tagline}>
              <input
                className={`${ui.search} w-full`}
                value={fields.tagline}
                maxLength={LIMITS.tagline}
                placeholder="Standups for teams that work at night"
                onChange={(e) => set("tagline", e.target.value)}
                onBlur={() => void save()}
              />
            </Field>
            <Field label="The problem it solves" count={fields.problem.length} max={LIMITS.problem}>
              <textarea
                className={`${ui.search} w-full`}
                rows={4}
                value={fields.problem}
                maxLength={LIMITS.problem}
                style={{ resize: "vertical" }}
                onChange={(e) => set("problem", e.target.value)}
                onBlur={() => void save()}
              />
            </Field>
            <Field
              label="Description"
              hint={<>Markdown: **bold**, *italic*, - lists, 1. steps, [links](https://…), # headings.</>}
              count={fields.description.length}
              max={LIMITS.description}
            >
              <textarea
                className={`${ui.search} w-full`}
                rows={8}
                value={fields.description}
                maxLength={LIMITS.description}
                style={{ resize: "vertical", fontFamily: "var(--font-mono, ui-monospace), monospace", fontSize: 12.5 }}
                placeholder={"What you built, how it works, what's next."}
                onChange={(e) => set("description", e.target.value)}
                onBlur={() => void save()}
              />
            </Field>
          </div>
        </div>

        <div className={ui.tile} style={{ padding: "18px 18px 20px" }}>
          <div className="space-y-5">
            {(["demo_url", "video_url", "repo_url"] as const).map((k) => (
              <Field
                key={k}
                label={k === "demo_url" ? "Demo URL" : k === "video_url" ? "Video URL (optional)" : "Repo URL (optional)"}
                hint={k === "video_url" ? "YouTube, Loom or Vimeo links play right on the page." : undefined}
                error={urlError(k)}
              >
                <input
                  className={`${ui.search} w-full`}
                  inputMode="url"
                  value={fields[k]}
                  maxLength={LIMITS.url}
                  placeholder="https://"
                  onChange={(e) => set(k, e.target.value)}
                  onBlur={() => void save()}
                />
              </Field>
            ))}
          </div>
        </div>

        <div className={ui.tile} style={{ padding: "18px 18px 20px" }}>
          <Screenshots
            hackathonId={sprint.id}
            teamId={team.id}
            paths={fields.screenshots}
            urls={urls}
            disabled={locked}
            onChange={(paths) => set("screenshots", paths, true)}
            onUploaded={(path, url) => setUrls((u) => ({ ...u, [path]: url }))}
          />
        </div>

        <div className={ui.tile} style={{ padding: "18px 18px 20px" }}>
          <TagInput tags={fields.built_with} disabled={locked} onChange={(tags) => set("built_with", tags, true)} />
        </div>
      </fieldset>

      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        <Link href={roomHref} style={{ color: "inherit" }}>
          ← Back to the team room
        </Link>
      </p>

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Preview of the reveal"
          className="fixed inset-0 z-50 overflow-y-auto scroll-thin"
          style={{ background: "rgba(8, 10, 14, 0.96)", backdropFilter: "blur(6px)" }}
          onKeyDown={(e) => e.key === "Escape" && setPreview(false)}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3" style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(8, 10, 14, 0.9)" }}>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Preview: how this will look at the reveal (including unsaved changes)</p>
            <button type="button" className={ui.softBtn} onClick={() => setPreview(false)} autoFocus>
              Close
            </button>
          </div>
          <div style={{ padding: "28px 20px 64px" }}>
            <ProjectShowcase fields={fields} screenshotUrls={orderedUrls} team={team} members={members} sprintNumber={sprint.number} />
          </div>
        </div>
      )}
    </div>
  );
}
