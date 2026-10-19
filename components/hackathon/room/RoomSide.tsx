"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Tile from "@/components/ui/Tile";
import PersonAvatar from "@/components/ui/PersonAvatar";
import Markdown from "@/components/Markdown";
import ui from "@/components/ui/sleek.module.css";
import { sprintDb } from "@/lib/hackathons/actions";
import { LABEL_RESET } from "@/lib/hackathons/submission";
import type { SprintState } from "@/lib/hackathons/sprint";
import { roomHref, type RoomDocRow, type RoomLinkRow, type RoomMember, type RoomSubmission, type RoomTeam, type RoomVoteRow } from "@/lib/hackathons/room";

// The team room's checklist, beside the conversation (2026-10-17): what to do,
// as five steps that tick themselves, with the two that need doing here built
// in: the presentation (one PDF, optional; migration 035) and the submission.
// One panel, so the right column stays as short as the chat beside it.

const META: React.CSSProperties = { fontSize: 11.5, color: "var(--text-muted)" };
const MAX_DECK = 25 * 1024 * 1024; // the deck bucket's own limit (035)
const DECK_BUCKET = "hackathon-decks";

type Step = { key: string; label: string; hint: string; done: boolean; body?: React.ReactNode };

export function ChecklistPanel({
  sprint,
  team,
  checkedInAt,
  isMember,
  docs,
  links,
  votes,
  submission,
  onSubmissionChanged,
}: {
  sprint: { id: string; number: number; state: SprintState; rules: string | null };
  team: RoomTeam;
  checkedInAt: string | null;
  isMember: boolean;
  docs: RoomDocRow[];
  links: RoomLinkRow[];
  votes: RoomVoteRow[];
  submission: RoomSubmission;
  onSubmissionChanged: (s: RoomSubmission) => void;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const before = ["registration", "teams_locked"].includes(sprint.state);
  const steps: Step[] = [
    {
      key: "checkin",
      label: "Check in at kickoff",
      hint: before ? "The button appears on the Buildathon page at kickoff." : "On the Buildathon page, so the team knows you're here.",
      done: Boolean(checkedInAt),
    },
    {
      key: "idea",
      label: "Agree on your idea",
      hint: "Start a vote or a doc so everyone builds the same thing.",
      done: votes.some((v) => v.status === "decided") || docs.length > 0,
    },
    { key: "link", label: "Add your repo or demo link", hint: "In Links, so reviewers can try it after the deadline.", done: links.length > 0 },
    {
      key: "deck",
      label: "Add your presentation",
      hint: "Optional: a PDF deck, shown with your project at the reveal.",
      done: Boolean(submission?.presentation_path),
      body: <DeckControl sprint={sprint} team={team} submission={submission} isMember={isMember} onChanged={onSubmissionChanged} />,
    },
    {
      key: "submit",
      label: "Submit before the deadline",
      hint: "The form locks on the dot. Late isn't possible.",
      done: Boolean(submission?.is_complete),
      body: <SubmitControl sprint={sprint} team={team} submission={submission} isMember={isMember} />,
    },
  ];
  const done = steps.filter((x) => x.done).length;

  return (
    <Tile kicker="Your checklist" right={`${done} of ${steps.length}`}>
      <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-secondary)" }}>
        Turn a business idea into something real in 48 hours: a working MVP, or the idea proven with something people can see.
        Submit before the deadline; your work stays sealed until the reveal.
      </p>
      <div className={ui.barTrack} style={{ marginTop: 10 }}>
        <div className={ui.barFill} style={{ background: "#f59e0b", width: `${Math.round((done / steps.length) * 100)}%` }} />
      </div>
      <ol className="flex flex-col" style={{ gap: 11, marginTop: 12 }}>
        {steps.map((x) => (
          <li key={x.key} className="flex items-start gap-2.5">
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: 18,
                height: 18,
                marginTop: 1,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                border: `1px solid ${x.done ? "rgba(34, 197, 94, 0.55)" : "rgba(255, 255, 255, 0.18)"}`,
                background: x.done ? "rgba(34, 197, 94, 0.14)" : "transparent",
                color: "#4ade80",
              }}
            >
              {x.done ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1">
              <span style={{ fontSize: 13, color: x.done && !x.body ? "var(--text-muted)" : "var(--text-primary)" }}>{x.label}</span>
              {!x.done && isMember && !x.body && <span style={{ ...META, display: "block", marginTop: 1 }}>{x.hint}</span>}
              {x.body && <span style={{ display: "block", marginTop: 6 }}>{x.body}</span>}
            </span>
          </li>
        ))}
      </ol>
      {sprint.rules?.trim() && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
          <button type="button" className={ui.textBtn} onClick={() => setRulesOpen((o) => !o)} aria-expanded={rulesOpen}>
            {rulesOpen ? "Hide the rules" : "Read the rules"}
          </button>
          {rulesOpen && (
            <div style={{ fontSize: 12.5, marginTop: 8, color: "var(--text-secondary)" }}>
              <Markdown source={sprint.rules} plainHeadings />
            </div>
          )}
        </div>
      )}
    </Tile>
  );
}

// ── The presentation: one PDF, optional
function DeckControl({
  sprint,
  team,
  submission,
  isMember,
  onChanged,
}: {
  sprint: { id: string; state: SprintState };
  team: RoomTeam;
  submission: RoomSubmission;
  isMember: boolean;
  onChanged: (s: RoomSubmission) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const canEdit = isMember && sprint.state === "live";
  const path = submission?.presentation_path ?? null;

  async function upload(file: File) {
    setError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setError("That isn't a PDF. Export your slides as a PDF and try again.");
    if (file.size > MAX_DECK) return setError(`That's ${(file.size / 1048576).toFixed(1)} MB; the limit is 25 MB.`);
    setBusy("Uploading…");
    const db = sprintDb();
    const next = `${sprint.id}/${team.id}/deck-${Date.now().toString(36)}.pdf`;
    const up = await db.storage.from(DECK_BUCKET).upload(next, file, { contentType: "application/pdf" });
    if (up.error) {
      setBusy(null);
      return setError(/row-level security|unauthorized|403/i.test(up.error.message) ? "Uploads are closed right now." : up.error.message);
    }
    const fields = { presentation_path: next, presentation_name: file.name.slice(0, 200), presentation_size: file.size };
    const saved = submission
      ? await db.from("hackathon_submissions").update(fields).eq("id", submission.id).select("*").single()
      : await db.from("hackathon_submissions").insert({ team_id: team.id, hackathon_id: sprint.id, ...fields }).select("*").single();
    if (saved.error) {
      await db.storage.from(DECK_BUCKET).remove([next]);
      setBusy(null);
      return setError(saved.error.message);
    }
    if (path) await db.storage.from(DECK_BUCKET).remove([path]);
    setBusy(null);
    onChanged(saved.data as RoomSubmission);
  }

  async function remove() {
    if (!submission || !path) return;
    setConfirmRemove(false);
    setError(null);
    setBusy("Removing…");
    const db = sprintDb();
    const saved = await db
      .from("hackathon_submissions")
      .update({ presentation_path: null, presentation_name: null, presentation_size: null })
      .eq("id", submission.id)
      .select("*")
      .single();
    if (saved.error) {
      setBusy(null);
      return setError(saved.error.message);
    }
    await db.storage.from(DECK_BUCKET).remove([path]);
    setBusy(null);
    onChanged(saved.data as RoomSubmission);
  }

  async function view() {
    if (!path) return;
    const { data, error: e } = await sprintDb().storage.from(DECK_BUCKET).createSignedUrl(path, 600);
    if (e || !data) return setError("Couldn't open the deck. Try again.");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const picker = (
    <input
      ref={input}
      type="file"
      accept="application/pdf,.pdf"
      className="sr-only"
      disabled={Boolean(busy)}
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) void upload(f);
      }}
    />
  );

  return (
    <>
      {path ? (
        <span className="flex items-center gap-2.5" style={{ border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 10, padding: "8px 10px" }}>
          <span
            aria-hidden
            style={{ flexShrink: 0, width: 26, height: 32, borderRadius: 5, border: "1px solid rgba(248, 113, 113, 0.45)", background: "rgba(248, 113, 113, 0.08)", color: "#fca5a5", fontSize: 8.5, fontWeight: 700, display: "inline-flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 3 }}
          >
            PDF
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate" style={{ fontSize: 12.5, color: "var(--text-primary)" }}>
              {submission?.presentation_name ?? "Presentation.pdf"}
            </span>
            <span style={META}>{submission?.presentation_size ? `${(submission.presentation_size / 1048576).toFixed(1)} MB` : "PDF"}</span>
          </span>
          <button type="button" className={ui.textBtn} onClick={() => void view()}>
            View
          </button>
        </span>
      ) : canEdit ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
          className="flex items-center gap-2 cursor-pointer"
          style={{
            // globals.css styles every <label> as small lower-case mono.
            ...LABEL_RESET,
            border: `1px dashed ${over ? "rgba(245, 158, 11, 0.7)" : "rgba(255, 255, 255, 0.18)"}`,
            background: over ? "rgba(245, 158, 11, 0.06)" : "rgba(255, 255, 255, 0.015)",
            borderRadius: 10,
            padding: "9px 11px",
          }}
        >
          <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{busy ?? "Drop a PDF here, or choose one"}</span>
          <span style={{ ...META, marginLeft: "auto" }}>up to 25 MB</span>
          {picker}
        </label>
      ) : (
        <span style={META}>
          {["registration", "teams_locked"].includes(sprint.state) ? "Uploads open at kickoff." : "No presentation was added."}
        </span>
      )}

      {path && canEdit && (
        <span className="flex items-center gap-3 flex-wrap" style={{ marginTop: 6 }}>
          <button type="button" className={ui.textBtn} disabled={Boolean(busy)} onClick={() => input.current?.click()}>
            {busy === "Uploading…" ? "Uploading…" : "Replace"}
          </button>
          {confirmRemove ? (
            <>
              <button type="button" className={ui.textBtn} style={{ color: "#f87171" }} onClick={() => void remove()}>
                Remove for the team
              </button>
              <button type="button" className={ui.textBtn} onClick={() => setConfirmRemove(false)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" className={ui.textBtn} disabled={Boolean(busy)} onClick={() => setConfirmRemove(true)}>
              Remove
            </button>
          )}
          {picker}
        </span>
      )}
      {error && <span style={{ display: "block", fontSize: 12, color: "#f87171", marginTop: 6 }}>{error}</span>}
    </>
  );
}

// ── The submission: what's missing, and the form
function SubmitControl({
  sprint,
  team,
  submission,
  isMember,
}: {
  sprint: { number: number; state: SprintState };
  team: RoomTeam;
  submission: RoomSubmission;
  isMember: boolean;
}) {
  const href = `${roomHref(sprint.number, team.slug)}/submission`;
  const before = ["registration", "teams_locked"].includes(sprint.state);
  const live = sprint.state === "live";
  const complete = Boolean(submission?.is_complete);
  const missing = submission
    ? [
        !submission.project_name && "a project name",
        !submission.tagline && "a tagline",
        !submission.problem && "the problem",
        !(submission.demo_url || submission.video_url || (submission.screenshots?.length ?? 0) > 0) && "a demo, video or screenshot",
      ].filter(Boolean)
    : ["a project name", "a tagline", "the problem", "a demo, video or screenshot"];

  if (before) return <span style={META}>The form opens at kickoff.</span>;
  return (
    <>
      <span style={{ ...META, display: "block" }}>
        {complete ? "It's in. You can keep improving it until the deadline." : `Still needed: ${missing.join(", ")}.`}
      </span>
      <Link
        href={href}
        className={live && isMember && !complete ? ui.primaryBtn : ui.softBtn}
        style={{ display: "inline-block", marginTop: 8, textDecoration: "none" }}
      >
        {live && isMember ? (complete ? "Edit submission →" : submission ? "Finish submission →" : "Open the submission form →") : "View submission →"}
      </Link>
    </>
  );
}

// ── After the reveal: what fellow builders said (036), without names
export type TeamFeedback = {
  strength: string | null;
  suggestion: string | null;
  score_problem: number;
  score_works: number;
  score_use: number;
  completed_at: string;
};

/**
 * After the reveal (owner, 2026-10-18: the point is building with others and
 * the connections that come from it): the project doesn't have to end with
 * the Buildathon. Keep it going on the Collab board, and keep talking to the
 * people you built it with.
 */
export function WhatsNextPanel({ members, viewerId, projectName }: { members: RoomMember[]; viewerId: string; projectName: string | null }) {
  const others = members.filter((m) => m.id !== viewerId);
  return (
    <Tile kicker="What's next">
      <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-secondary)" }}>
        {projectName ? <>Think {projectName} could be real? </> : <>Think it could be real? </>}
        Keep going together: post it on the Collab board to find the people it still needs.
      </p>
      <Link href="/collab" className={ui.ghostBtn} style={{ textDecoration: "none", marginTop: 10, display: "inline-flex" }}>
        Post it on the Collab board →
      </Link>
      {others.length > 0 && (
        <>
          <p style={{ ...META, marginTop: 16, marginBottom: 8 }}>The people you built with</p>
          <ul className="flex flex-col" style={{ gap: 8 }}>
            {others.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5">
                <PersonAvatar name={m.full_name} stage={m.stage} username={m.username} size={26} />
                <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13, color: "var(--text-primary)" }}>
                  {m.full_name ?? m.username ?? "Founder"}
                </span>
                <Link href={`/messages?to=${m.id}`} className={ui.textBtn} style={{ textDecoration: "none" }}>
                  Message
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Tile>
  );
}

export function FeedbackPanel({ feedback }: { feedback: TeamFeedback[] }) {
  const avg = (k: "score_problem" | "score_works" | "score_use") =>
    feedback.length ? (feedback.reduce((n, f) => n + f[k], 0) / feedback.length).toFixed(1) : "—";
  const lines = feedback.filter((f) => f.strength || f.suggestion);
  return (
    <Tile gradient kicker="What fellow builders said" right={`${feedback.length} review${feedback.length === 1 ? "" : "s"}`}>
      {feedback.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Nobody reviewed this project.</p>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {[
              { label: "Problem", v: avg("score_problem") },
              { label: "Works", v: avg("score_works") },
              { label: "Would use", v: avg("score_use") },
            ].map((x) => (
              <div key={x.label} style={{ border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 18, fontWeight: 650, color: "var(--text-primary)" }}>{x.v}</div>
                <div style={META}>{x.label} · of 5</div>
              </div>
            ))}
          </div>
          {lines.length > 0 && (
            <ul className="flex flex-col" style={{ gap: 10, marginTop: 12 }}>
              {lines.map((f, i) => (
                <li key={i} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                  {f.strength && (
                    <p style={{ color: "var(--text-primary)" }}>
                      <span style={{ color: "#4ade80" }}>+ </span>
                      {f.strength}
                    </p>
                  )}
                  {f.suggestion && (
                    <p style={{ color: "var(--text-secondary)", marginTop: f.strength ? 2 : 0 }}>
                      <span style={{ color: "#f8c56a" }}>→ </span>
                      {f.suggestion}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p style={{ ...META, marginTop: 10 }}>Anonymous: you see what was said, not who said it.</p>
        </>
      )}
    </Tile>
  );
}
