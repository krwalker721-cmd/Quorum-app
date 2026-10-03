"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Countdown from "@/components/countdown/Countdown";
import PersonAvatar from "@/components/ui/PersonAvatar";
import ui from "@/components/ui/sleek.module.css";
import { usePresence } from "@/components/PresenceProvider";
import { TeamBadge } from "@/components/hackathon/TeamStyle";
import LocalTime from "@/components/hackathon/LocalTime";
import { approxServerNow } from "@/lib/useServerNow";
import { stageCountdown, type SprintState, type SprintTiming } from "@/lib/hackathons/sprint";
import { quietState, spanText, NIGHT_ENDS_HOUR } from "@/lib/hackathons/quiet";
import { roomHref, type MemberActivity, type RoomMember, type RoomTeam } from "@/lib/hackathons/room";

const AMBER = "#f8c56a";
const MIN = 60_000;

function ago(iso: string, now: number) {
  const m = Math.max(0, Math.floor((now - Date.parse(iso)) / MIN));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

const clock = (ms: number) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(ms);

/**
 * The top of the team room: the team, where the Sprint stands (countdown,
 * theme from kickoff), the submission button, and every teammate with whether
 * they're online, when they were last active, and, while the Sprint is live,
 * a soft note when one has gone quiet for three waking hours.
 */
export default function RoomHeader({
  sprint,
  team,
  members,
  activity,
  viewerId,
  isMember,
  writable,
  submittedAt,
  hasDraft = false,
  onSleep,
}: {
  sprint: { number: number; state: SprintState; theme: string | null; timing: SprintTiming };
  team: RoomTeam;
  members: RoomMember[];
  activity: Map<string, MemberActivity>;
  viewerId: string;
  isMember: boolean;
  writable: boolean;
  submittedAt: string | null;
  /** A draft exists (it only counts once complete). */
  hasDraft?: boolean;
  onSleep: (until: number | null) => Promise<string | null>;
}) {
  const online = usePresence();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(approxServerNow());
    const t = setInterval(() => setNow(approxServerNow()), 30_000);
    return () => clearInterval(t);
  }, []);
  // Re-label straight away when activity arrives.
  useEffect(() => setNow(approxServerNow()), [activity]);

  const live = sprint.state === "live";
  const kickoff = sprint.timing.starts_at ? Date.parse(sprint.timing.starts_at) : 0;
  const showTheme = Boolean(sprint.theme) && ["live", "judging", "revealed"].includes(sprint.state);

  return (
    <header style={{ marginBottom: 18 }}>
      <Link href={`/hackathon/${sprint.number}`} style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
        ← Sprint #{sprint.number}
      </Link>

      <div className={ui.tile} style={{ marginTop: 12, padding: "18px 20px" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <TeamBadge name={team.name} emblem={team.emblem} color={team.color} size={44} />
            <div className="min-w-0">
              <h1
                className={`${ui.titleGradient} ${ui.balance}`}
                style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}
              >
                {team.name}
              </h1>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Team room · private to the team{team.is_random_matched ? " · matched" : ""}
              </p>
            </div>
          </div>
          <SubmissionBox sprint={sprint} team={team} submittedAt={submittedAt} hasDraft={hasDraft} isMember={isMember} />
        </div>

        <div className="flex flex-wrap items-start gap-x-8 gap-y-3" style={{ marginTop: 16 }}>
          <StageClock state={sprint.state} timing={sprint.timing} />
          {showTheme && (
            <div className="min-w-0" style={{ maxWidth: "60ch" }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Theme</p>
              <p style={{ fontSize: 14, color: "var(--text-primary)", marginTop: 2, lineHeight: 1.45 }}>{sprint.theme}</p>
            </div>
          )}
        </div>

        {/* One swipeable row on phones, so the room itself starts on the first screen. */}
        <div
          className="flex sm:grid gap-2.5 overflow-x-auto sm:overflow-visible scroll-thin"
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          }}
        >
          {[...members].sort((a, b) => Number(b.id === viewerId) - Number(a.id === viewerId)).map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              activity={activity.get(m.id)}
              online={online.has(m.id)}
              isYou={m.id === viewerId}
              live={live}
              kickoff={kickoff}
              now={now}
              canSleep={m.id === viewerId && live && writable}
              onSleep={onSleep}
            />
          ))}
        </div>
      </div>
    </header>
  );
}

function StageClock({ state, timing }: { state: SprintState; timing: SprintTiming }) {
  const stage = stageCountdown(state);
  const target = stage ? (timing[stage.key] as string | null) : null;
  if (!stage || !target) {
    if (state === "revealed") return <ClockText label="Results are out" value="The room is read-only now" />;
    if (state === "paused") return <ClockText label="Sprint paused" value="The clock has stopped" />;
    if (state === "cancelled") return <ClockText label="Sprint cancelled" value="Nothing more will happen" />;
    return null;
  }
  return (
    <div>
      <p style={{ fontSize: 12, color: state === "live" ? AMBER : "var(--text-muted)" }}>
        {timing.countdown_headline_override || stage.label}
      </p>
      <div style={{ fontSize: 15, color: "var(--text-primary)", marginTop: 2 }}>
        {timing.show_countdown_in_app ? <Countdown target={target} size="inline" /> : <LocalTime iso={target} />}
      </div>
    </div>
  );
}

function ClockText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</p>
      <p style={{ fontSize: 14, color: "var(--text-primary)", marginTop: 2 }}>{value}</p>
    </div>
  );
}

function SubmissionBox({
  sprint,
  team,
  submittedAt,
  hasDraft,
  isMember,
}: {
  sprint: { number: number; state: SprintState };
  team: RoomTeam;
  submittedAt: string | null;
  hasDraft: boolean;
  isMember: boolean;
}) {
  const href = `${roomHref(sprint.number, team.slug)}/submission`;
  const status = submittedAt ? (
    <>
      <span style={{ color: "#4ade80" }}>Submitted ✓</span> · <LocalTime iso={submittedAt} />
    </>
  ) : hasDraft ? (
    "Draft in progress · not submitted yet"
  ) : (
    "Not submitted yet"
  );

  let button: React.ReactNode;
  let line: React.ReactNode = status;
  if (sprint.state === "live" && isMember) {
    button = (
      <Link href={href} className={ui.primaryBtn}>
        {submittedAt ? "Edit submission" : hasDraft ? "Finish submission" : "Submit project"}
      </Link>
    );
  } else if (["registration", "teams_locked"].includes(sprint.state)) {
    button = (
      <span className={ui.softBtn} aria-disabled style={{ opacity: 0.55, cursor: "default" }}>
        Submit project
      </span>
    );
    line = "Opens at kickoff";
  } else {
    button = (
      <Link href={href} className={ui.softBtn}>
        View submission
      </Link>
    );
    if (sprint.state === "paused") line = <>Paused · {status}</>;
    else if (sprint.state === "live") line = status;
    else line = submittedAt ? <>Submissions closed · {status}</> : "Submissions closed · not submitted";
  }

  return (
    <div className="flex flex-col items-start sm:items-end gap-1.5">
      {button}
      <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{line}</p>
    </div>
  );
}

function MemberRow({
  member,
  activity,
  online,
  isYou,
  live,
  kickoff,
  now,
  canSleep,
  onSleep,
}: {
  member: RoomMember;
  activity: MemberActivity | undefined;
  online: boolean;
  isYou: boolean;
  live: boolean;
  kickoff: number;
  now: number;
  canSleep: boolean;
  onSleep: (until: number | null) => Promise<string | null>;
}) {
  const quiet = live ? quietState(activity, kickoff, now) : null;
  const asleep = quiet?.kind === "asleep" ? quiet.until : null;

  let line: React.ReactNode;
  let flagged = false;
  if (asleep) {
    line = <>Sleeping until {clock(asleep)}</>;
  } else if (quiet?.kind === "quiet" && !isYou) {
    flagged = true;
    line = (
      <>
        Hasn&rsquo;t been active in {spanText(now - quiet.sinceMs)}
        {activity?.last_seen_at ? ` · seen ${ago(activity.last_seen_at, now)}` : ""}
      </>
    );
  } else if (activity?.last_active_at) {
    line = <>Active {ago(activity.last_active_at, now)}</>;
  } else if (activity?.last_seen_at) {
    line = <>Seen {ago(activity.last_seen_at, now)}</>;
  } else {
    line = "Not active yet";
  }

  return (
    <div
      className="flex items-center gap-3 min-w-[230px] sm:min-w-0 shrink-0 sm:shrink"
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        border: `1px solid ${flagged ? "rgba(245, 158, 11, 0.28)" : "rgba(255, 255, 255, 0.05)"}`,
        background: flagged ? "rgba(245, 158, 11, 0.05)" : "rgba(255, 255, 255, 0.015)",
      }}
    >
      <PersonAvatar name={member.full_name} stage={member.stage} username={member.username} size={30} active={online} />
      <div className="min-w-0 flex-1">
        <p className="truncate" style={{ fontSize: 13, color: "var(--text-primary)" }}>
          {member.full_name ?? member.username ?? "Founder"}
          {member.role === "owner" && <span style={{ fontSize: 11.5, color: AMBER, marginLeft: 6 }}>Owner</span>}
          {isYou && <span style={{ fontSize: 11.5, color: "var(--text-muted)", marginLeft: 6 }}>You</span>}
        </p>
        <p className="truncate" style={{ fontSize: 11.5, color: flagged ? AMBER : "var(--text-muted)", marginTop: 1 }}>
          {line}
        </p>
      </div>
      {canSleep && <SleepControl asleep={asleep !== null} onSleep={onSleep} now={now} />}
    </div>
  );
}

/** "Sleeping until…", for yourself: a few lengths, or until 7 am. */
function SleepControl({
  asleep,
  onSleep,
  now,
}: {
  asleep: boolean;
  onSleep: (until: number | null) => Promise<string | null>;
  now: number;
}) {
  // Where the menu opens: fixed to the button, since on phones the members
  // row scrolls sideways and would clip a menu inside it.
  const [open, setOpen] = useState<{ top: number; right: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const away = () => setOpen(null);
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", away);
    document.addEventListener("scroll", away, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", away);
      document.removeEventListener("scroll", away, true);
    };
  }, [open]);

  async function set(until: number | null) {
    setBusy(true);
    setError(null);
    const e = await onSleep(until);
    setBusy(false);
    if (e) setError(e);
    else setOpen(null);
  }

  if (asleep) {
    return (
      <button type="button" className={ui.textBtn} style={{ fontSize: 12 }} disabled={busy} onClick={() => set(null)}>
        I&rsquo;m up
      </button>
    );
  }

  // The next 7 am on this device, if it's within the 12 hours allowed.
  const morning = new Date(now);
  morning.setHours(NIGHT_ENDS_HOUR, 0, 0, 0);
  if (morning.getTime() <= now) morning.setDate(morning.getDate() + 1);
  const options: { label: string; at: number }[] = [2, 4, 6, 8].map((h) => ({ label: `${h} hours`, at: now + h * 3_600_000 }));
  if (morning.getTime() - now <= 12 * 3_600_000) options.push({ label: `Until ${clock(morning.getTime())}`, at: morning.getTime() });

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        className={ui.textBtn}
        style={{ fontSize: 12 }}
        aria-expanded={!!open}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setOpen((v) => (v ? null : { top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) }));
        }}
        title="Let the team know you're sleeping, so you don't show as quiet"
      >
        Sleeping…
      </button>
      {open && (
        <div className={`fixed z-40 min-w-[170px] ${ui.menu}`} style={{ top: open.top, right: open.right }}>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", padding: "6px 10px 4px" }}>Sleeping for</p>
          {options.map((o) => (
            <button key={o.label} type="button" className={ui.menuItem} disabled={busy} onClick={() => set(o.at)}>
              {o.label}
            </button>
          ))}
          {error && <p style={{ fontSize: 11.5, color: "#f87171", padding: "4px 10px 6px" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
