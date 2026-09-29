"use client";

import { useState } from "react";
import Link from "next/link";
import ui from "@/components/ui/sleek.module.css";
import PersonAvatar from "@/components/ui/PersonAvatar";
import { register, rpc, setMode, useSprintAction, withdraw } from "@/lib/hackathons/actions";
import type { ArenaTeam, QueueData, Viewer } from "@/lib/hackathons/page";
import LocalTime from "./LocalTime";
import { COLORS, EMBLEMS, StylePicker, TeamBadge } from "./TeamStyle";

// The join queue (Prompt 4): join the Sprint in one of three ways, switch
// between them, or withdraw, all while registration is open. The database
// enforces every rule (registration window, one team, team size); this only
// offers the choices that make sense for where you are.

type SprintInfo = { id: string; number: number; team_lock_at: string | null; open: boolean };
type Step = null | "choose" | "create" | "join";

export default function JoinQueueClient({
  sprint,
  viewer,
  teams,
  queue,
}: {
  sprint: SprintInfo;
  viewer: Viewer;
  teams: ArenaTeam[];
  queue: QueueData;
}) {
  const { busy, error, run } = useSprintAction();
  const [step, setStep] = useState<Step>(null);
  const uid = viewer.userId;
  const registered = viewer.role === "participant";
  const onTeam = !!viewer.teamId;

  const counts = queue.counts && (
    <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
      <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{queue.counts.registered}</strong> registered ·{" "}
      <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{queue.counts.random_pool}</strong> in the random pool ·{" "}
      <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{queue.counts.teams}</strong> team{queue.counts.teams === 1 ? "" : "s"}
      {sprint.team_lock_at && (
        <span style={{ color: "var(--text-muted)" }}>
          {" "}
          · teams lock <LocalTime iso={sprint.team_lock_at} />
        </span>
      )}
    </p>
  );

  const invitations = queue.myInvitations.length > 0 && (
    <ul className="flex flex-col" style={{ gap: 8 }}>
      {queue.myInvitations.map((i) => {
        const team = teams.find((t) => t.id === i.team_id);
        return (
          <li
            key={i.id}
            className="flex items-center justify-between gap-3 flex-wrap"
            style={{ border: "1px solid rgba(245, 158, 11, 0.35)", background: "rgba(245, 158, 11, 0.06)", borderRadius: 10, padding: "10px 12px" }}
          >
            <span className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--text-primary)" }}>
              {team && <TeamBadge name={team.name} emblem={team.emblem} color={team.color} size={22} />}
              <span>
                <strong style={{ fontWeight: 600 }}>{i.team_name}</strong> invited you
                {i.invited_by ? <span style={{ color: "var(--text-muted)" }}> · from {i.invited_by}</span> : null}
              </span>
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                className={ui.primaryBtn}
                disabled={busy || !sprint.open}
                onClick={() => run(() => rpc("hackathon_respond_to_invitation", { p_invitation_id: i.id, p_accept: true }))}
              >
                Join {i.team_name}
              </button>
              <button
                type="button"
                className={ui.ghostBtn}
                disabled={busy}
                onClick={() => run(() => rpc("hackathon_respond_to_invitation", { p_invitation_id: i.id, p_accept: false }))}
              >
                Decline
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );

  let body: React.ReactNode;

  if (viewer.role === "outsider") {
    body = (
      <p className={ui.emptyTitle}>
        Joining a Sprint needs an active membership.{" "}
        <Link href="/pricing" style={{ color: "#f8c56a" }}>
          See plans
        </Link>
      </p>
    );
  } else if (viewer.role === "judge" || viewer.role === "invited_judge") {
    body = <p className={ui.emptyTitle}>You're judging this Sprint, so you can't compete in it.</p>;
  } else if (!sprint.open) {
    body = <p className={ui.emptyTitle}>Registration is paused. It picks up where it left off when the Sprint resumes.</p>;
  } else if (registered && onTeam) {
    body = (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className={ui.emptyTitle}>
          You're on <strong style={{ color: "var(--text-primary)" }}>{teams.find((t) => t.id === viewer.teamId)?.name ?? "a team"}</strong>.
          Your team is below.
        </p>
        <WithdrawButton sprintId={sprint.id} uid={uid} run={run} busy={busy} />
      </div>
    );
  } else if (registered) {
    const inPool = viewer.mode === "random";
    body = (
      <div className="flex flex-col" style={{ gap: 12 }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div style={{ minWidth: 0, flex: "1 1 260px" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              {inPool ? "You're in the random pool" : "You're registered and looking for a team"}
            </p>
            <p className={ui.emptySub}>
              {inPool
                ? "At team lock you'll be matched into a team, mixed across cohorts. You can still start or join a team before then."
                : "Start a team or join one before teams lock. Anyone still without a team at lock is matched into one."}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {inPool ? (
              <button type="button" className={ui.ghostBtn} disabled={busy} onClick={() => setStep(step ? null : "choose")}>
                Switch to a team
              </button>
            ) : (
              <button type="button" className={ui.ghostBtn} disabled={busy} onClick={() => run(() => setMode(sprint.id, uid, "random"))}>
                Put me in the random pool
              </button>
            )}
            <WithdrawButton sprintId={sprint.id} uid={uid} run={run} busy={busy} />
          </div>
        </div>
        {queue.myRequests.length > 0 && (
          <ul className="flex flex-col" style={{ gap: 6 }}>
            {queue.myRequests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3" style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                <span>
                  Asked to join <strong style={{ color: "var(--text-primary)" }}>{r.team_name}</strong>, waiting for the owner
                </span>
                <button
                  type="button"
                  className={ui.textBtn}
                  disabled={busy}
                  onClick={() => run(() => rpc("hackathon_cancel_join_request", { p_request_id: r.id }))}
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
        {(step || !inPool) && (
          <Choices
            sprint={sprint}
            uid={uid}
            teams={teams}
            queue={queue}
            registered
            step={step ?? "choose"}
            setStep={setStep}
            hideRandom
            run={run}
            busy={busy}
          />
        )}
      </div>
    );
  } else {
    // Not registered (or withdrew): the way in.
    body = step ? (
      <Choices sprint={sprint} uid={uid} teams={teams} queue={queue} registered={false} step={step} setStep={setStep} run={run} busy={busy} />
    ) : (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className={ui.emptyTitle}>
          {viewer.withdrawn ? "You withdrew from this Sprint. You can come back until teams lock." : "48 hours, a new team, something new. Want in?"}
        </p>
        <button type="button" className={ui.primaryBtn} disabled={busy} onClick={() => setStep("choose")}>
          {viewer.withdrawn ? `Rejoin Sprint #${sprint.number}` : `Join Sprint #${sprint.number}`}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      {counts}
      {invitations}
      {body}
      {error && (
        <p role="alert" style={{ fontSize: 12.5, color: "#fca5a5" }}>
          {error}
        </p>
      )}
    </div>
  );
}

type Run = ReturnType<typeof useSprintAction>["run"];

function WithdrawButton({ sprintId, uid, run, busy }: { sprintId: string; uid: string; run: Run; busy: boolean }) {
  return (
    <button
      type="button"
      className={ui.textBtn}
      disabled={busy}
      onClick={() => {
        if (window.confirm("Withdraw from this Sprint? You'll leave your team, if you're on one. You can come back until teams lock.")) {
          run(() => withdraw(sprintId, uid));
        }
      }}
    >
      Withdraw
    </button>
  );
}

/** The three ways in: the random pool, a new team, or an existing one. */
function Choices({
  sprint,
  uid,
  teams,
  queue,
  registered,
  step,
  setStep,
  hideRandom = false,
  run,
  busy,
}: {
  sprint: SprintInfo;
  uid: string;
  teams: ArenaTeam[];
  queue: QueueData;
  registered: boolean;
  step: Exclude<Step, null>;
  setStep: (s: Step) => void;
  hideRandom?: boolean;
  run: Run;
  busy: boolean;
}) {
  if (step === "create") {
    return <CreateTeam sprint={sprint} uid={uid} registered={registered} onBack={() => setStep("choose")} run={run} busy={busy} />;
  }
  if (step === "join") {
    return (
      <JoinTeam sprint={sprint} uid={uid} teams={teams} queue={queue} registered={registered} onBack={() => setStep("choose")} run={run} busy={busy} />
    );
  }

  const option = (title: string, sub: string, onClick: () => void, primary = false) => (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="text-left"
      style={{
        flex: "1 1 200px",
        borderRadius: 10,
        padding: "12px 14px",
        border: `1px solid ${primary ? "rgba(245, 158, 11, 0.4)" : "rgba(255, 255, 255, 0.1)"}`,
        background: primary ? "rgba(245, 158, 11, 0.07)" : "rgba(255, 255, 255, 0.02)",
        cursor: "pointer",
      }}
    >
      <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: primary ? "#f8c56a" : "var(--text-primary)" }}>{title}</span>
      <span style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginTop: 3, lineHeight: 1.45 }}>{sub}</span>
    </button>
  );

  return (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <div className="flex flex-wrap" style={{ gap: 10 }}>
        {!hideRandom &&
          option("Put me in the random pool", "You'll be matched into a team at team lock, mixed across cohorts.", () =>
            run(() => register(sprint.id, uid, "random"), () => setStep(null)), true)}
        {option("Create a team", "Name it, pick an emblem and colour, invite people.", () => setStep("create"))}
        {option("Join a team", "Browse teams with open spots, or use an invite link.", () => setStep("join"))}
      </div>
      {!registered && (
        <button type="button" className={ui.textBtn} style={{ alignSelf: "flex-start" }} onClick={() => setStep(null)}>
          Not now
        </button>
      )}
    </div>
  );
}

function CreateTeam({
  sprint,
  uid,
  registered,
  onBack,
  run,
  busy,
}: {
  sprint: SprintInfo;
  uid: string;
  registered: boolean;
  onBack: () => void;
  run: Run;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [style, setStyle] = useState({ emblem: EMBLEMS[0], color: COLORS[0] });
  const [open, setOpen] = useState(true);

  async function create() {
    await run(async () => {
      if (!registered) {
        const r = await register(sprint.id, uid, "team");
        if (r.error) return r;
      }
      return rpc("hackathon_create_team", {
        p_hackathon_id: sprint.id,
        p_name: name.trim(),
        p_emblem: style.emblem,
        p_color: style.color,
        p_open_to_requests: open,
      });
    });
  }

  return (
    <form
      className="flex flex-col"
      style={{ gap: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim().length >= 2) create();
      }}
    >
      <label className="flex flex-col" style={{ gap: 5 }}>
        <span className={ui.label}>Team name</span>
        <span className="flex items-center gap-2">
          <TeamBadge name={name || "?"} emblem={style.emblem} color={style.color} size={34} />
          <input
            className={ui.search}
            style={{ flex: 1, minWidth: 0 }}
            value={name}
            maxLength={40}
            placeholder="e.g. Night Shift"
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </span>
      </label>
      <StylePicker emblem={style.emblem} color={style.color} onChange={setStyle} />
      <label className="flex items-center gap-2" style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
        Open to requests: anyone can ask to join
      </label>
      <div className="flex gap-2">
        <button type="submit" className={ui.primaryBtn} disabled={busy || name.trim().length < 2}>
          Create team
        </button>
        <button type="button" className={ui.ghostBtn} onClick={onBack}>
          Back
        </button>
      </div>
    </form>
  );
}

function JoinTeam({
  sprint,
  uid,
  teams,
  queue,
  registered,
  onBack,
  run,
  busy,
}: {
  sprint: SprintInfo;
  uid: string;
  teams: ArenaTeam[];
  queue: QueueData;
  registered: boolean;
  onBack: () => void;
  run: Run;
  busy: boolean;
}) {
  const [code, setCode] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const requested = new Set(queue.myRequests.map((r) => r.team_id));
  const open = teams.filter((t) => t.is_open_to_requests && t.members.length < t.max_size);
  const others = teams.length - open.length;

  async function ask(teamId: string) {
    const ok = await run(async () => {
      if (!registered) {
        const r = await register(sprint.id, uid, "team");
        if (r.error) return r;
      }
      return rpc("hackathon_request_to_join", { p_team_id: teamId, p_message: message.trim() || null });
    });
    if (ok) {
      setAsking(null);
      setMessage("");
    }
  }

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <form
        className="flex items-center gap-2 flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) run(() => rpc("hackathon_join_with_code", { p_code: code }));
        }}
      >
        <input
          className={ui.search}
          style={{ flex: "1 1 180px", textTransform: "uppercase", letterSpacing: "0.08em" }}
          value={code}
          maxLength={20}
          placeholder="Invite code"
          aria-label="Invite code"
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="submit" className={ui.softBtn} disabled={busy || !code.trim()}>
          Join with code
        </button>
      </form>

      <p className={ui.label}>Teams with open spots</p>
      {open.length === 0 ? (
        <p className={ui.emptySub}>No team is taking requests right now. Start your own, or ask a team for its invite link.</p>
      ) : (
        <ul className="flex flex-col" style={{ gap: 8 }}>
          {open.map((t) => {
            const spots = t.max_size - t.members.length;
            return (
              <li key={t.id} style={{ border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 10, padding: "10px 12px" }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="flex items-center gap-2" style={{ minWidth: 0 }}>
                    <TeamBadge name={t.name} emblem={t.emblem} color={t.color} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</span>
                    <span className={ui.chip}>
                      {spots} open spot{spots === 1 ? "" : "s"}
                    </span>
                  </span>
                  {requested.has(t.id) ? (
                    <span className={`${ui.chip} ${ui.chipAmber}`}>Requested</span>
                  ) : (
                    <button type="button" className={ui.softBtn} disabled={busy} onClick={() => setAsking(asking === t.id ? null : t.id)}>
                      Ask to join
                    </button>
                  )}
                </div>
                <ul className="flex flex-wrap" style={{ gap: "6px 10px", marginTop: 8 }}>
                  {t.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-1.5">
                      <PersonAvatar name={m.full_name} stage={m.stage} username={m.username} size={20} />
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{(m.full_name ?? "Founder").split(/\s+/)[0]}</span>
                    </li>
                  ))}
                </ul>
                {asking === t.id && (
                  <form
                    className="flex flex-col"
                    style={{ gap: 8, marginTop: 10 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      ask(t.id);
                    }}
                  >
                    <textarea
                      className={ui.search}
                      rows={2}
                      maxLength={500}
                      value={message}
                      placeholder="What would you bring? (optional)"
                      onChange={(e) => setMessage(e.target.value)}
                    />
                    <span className="flex gap-2">
                      <button type="submit" className={ui.primaryBtn} disabled={busy}>
                        Send request
                      </button>
                      <button type="button" className={ui.ghostBtn} onClick={() => setAsking(null)}>
                        Cancel
                      </button>
                    </span>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {others > 0 && (
        <p className={ui.emptySub}>
          {others} other team{others === 1 ? " is" : "s are"} full or invite-only.
        </p>
      )}
      <button type="button" className={ui.ghostBtn} style={{ alignSelf: "flex-start" }} onClick={onBack}>
        Back
      </button>
    </div>
  );
}
