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
import type { MemberActivity, RoomMember, RoomTeam } from "@/lib/hackathons/room";

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
 * The top of the team room, laid out like a Collab project room's: the way
 * back, the team's name, a line of facts (where the Sprint stands, its clock,
 * matched or not) and the theme from kickoff.
 */
export function RoomTitle({
  sprint,
  team,
}: {
  sprint: { number: number; state: SprintState; theme: string | null; timing: SprintTiming };
  team: RoomTeam;
}) {
  const showTheme = Boolean(sprint.theme) && ["live", "judging", "revealed"].includes(sprint.state);
  const live = sprint.state === "live";
  const status =
    sprint.state === "live"
      ? "Live"
      : sprint.state === "paused"
        ? "Paused"
        : ["registration", "teams_locked"].includes(sprint.state)
          ? "Before kickoff"
          : sprint.state === "judging"
            ? "Judging"
            : sprint.state === "cancelled"
              ? "Cancelled"
              : "Read-only";
  return (
    <div style={{ marginBottom: 20 }}>
      <Link href={`/hackathon/${sprint.number}`} className={ui.tileLink}>
        ← Sprint #{sprint.number}
      </Link>
      <div className="flex items-center gap-3" style={{ marginTop: 12 }}>
        <TeamBadge name={team.name} emblem={team.emblem} color={team.color} size={34} />
        <h1
          className={`${ui.titleGradient} ${ui.balance} min-w-0`}
          style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}
        >
          {team.name}
        </h1>
      </div>
      <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap" style={{ marginTop: 10 }}>
        <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: live ? "var(--green)" : "var(--text-muted)" }}>
          <span aria-hidden className={ui.quietDot} style={live ? { background: "#22c55e", opacity: 1 } : undefined} />
          {status}
        </span>
        <span className={ui.chip}>Team room · private to the team</span>
        {team.is_random_matched && <span className={ui.chip}>Matched</span>}
        <InlineClock state={sprint.state} timing={sprint.timing} />
      </div>
      {showTheme && (
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)", marginTop: 12, maxWidth: "72ch" }}>
          <span style={{ color: "var(--text-muted)" }}>Theme · </span>
          <span style={{ color: AMBER }}>{sprint.theme}</span>
        </p>
      )}
    </div>
  );
}

/** The clock as one line in the title's facts: "Submissions close in 1d 21:40:02". */
function InlineClock({ state, timing }: { state: SprintState; timing: SprintTiming }) {
  const stage = stageCountdown(state);
  const target = stage ? (timing[stage.key] as string | null) : null;
  if (!stage || !target) return null;
  return (
    <span className="inline-flex items-baseline gap-1.5" style={{ fontSize: 12, color: "var(--text-muted)" }}>
      {timing.countdown_headline_override || stage.label}
      <span style={{ color: state === "live" ? AMBER : "var(--text-primary)" }}>
        {timing.show_countdown_in_app ? <Countdown target={target} size="inline" /> : <LocalTime iso={target} />}
      </span>
    </span>
  );
}

/**
 * The team, as a row of compact chips under the title: each teammate, whether
 * they're online, when they were last active, and, while the Sprint is live,
 * a soft note when one has gone quiet for three waking hours. Your own chip
 * has "Sleeping…", so you don't show as quiet.
 */
export function MembersStrip({
  sprint,
  members,
  activity,
  viewerId,
  writable,
  onSleep,
}: {
  sprint: { state: SprintState; timing: SprintTiming };
  members: RoomMember[];
  activity: Map<string, MemberActivity>;
  viewerId: string;
  writable: boolean;
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
  return (
    <div
      className="grid"
      aria-label="Your team"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8, marginTop: -6, marginBottom: 18 }}
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
      className="flex items-center gap-3 min-w-0"
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
