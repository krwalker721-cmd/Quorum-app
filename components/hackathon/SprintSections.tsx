import Link from "next/link";
import Tile from "@/components/ui/Tile";
import PersonAvatar from "@/components/ui/PersonAvatar";
import Markdown from "@/components/Markdown";
import ui from "@/components/ui/sleek.module.css";
import { MILESTONES, labelFor } from "@/lib/hackathons/timeline";
import { STATE_LABEL, type SprintRow } from "@/lib/hackathons/sprint";
import type { Registrant, SprintPageData } from "@/lib/hackathons/page";
import LocalTime from "./LocalTime";

// The Sprint page's building blocks that don't belong to a later prompt. The
// join queue (Prompt 4), the arena (Prompt 5) and the reveal gallery (Prompt
// 10) have their own files, so each can be replaced without touching this one.

const AMBER = "#f8c56a";

/** Draft, paused and cancelled: a clear line at the top of the page. */
export function StatusBanner({ sprint }: { sprint: SprintRow }) {
  let tone: "amber" | "red" | "grey";
  let title: string;
  let body: React.ReactNode;

  if (sprint.state === "draft") {
    tone = "grey";
    title = "Draft";
    body = "Only admins can see this page. Publish the Sprint in the admin console to open it to members.";
  } else if (sprint.state === "paused") {
    tone = "amber";
    title = "This Sprint is paused";
    body = (
      <>
        The clock stopped{sprint.status_override_at ? <> at <LocalTime iso={sprint.status_override_at} /></> : null}.
        Team rooms, submissions and judging are frozen until it resumes; the lobby stays open. When it resumes, the
        times on this page update on their own.
      </>
    );
  } else if (sprint.state === "cancelled") {
    tone = "red";
    title = "This Sprint was cancelled";
    body = "Nothing more will happen in it. Participants can still read the lobby.";
  } else {
    return null;
  }

  const colors = {
    amber: { border: "rgba(245, 158, 11, 0.4)", bg: "rgba(245, 158, 11, 0.08)", title: AMBER },
    red: { border: "rgba(248, 113, 113, 0.4)", bg: "rgba(248, 113, 113, 0.07)", title: "#fca5a5" },
    grey: { border: "rgba(255, 255, 255, 0.14)", bg: "rgba(255, 255, 255, 0.03)", title: "var(--text-primary)" },
  }[tone];

  return (
    <div
      role="status"
      style={{
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        borderRadius: 12,
        padding: "12px 16px",
        marginBottom: 16,
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600, color: colors.title }}>{title}</p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.55 }}>{body}</p>
    </div>
  );
}

/** Number, title, tagline and where the Sprint stands. */
export function SprintHero({ sprint }: { sprint: SprintRow }) {
  const live = sprint.state === "live";
  return (
    <header style={{ marginBottom: 18 }}>
      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Sprint #{sprint.number}</span>
        <span className={`${ui.chip} ${live ? ui.chipAmber : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {live && <span className={ui.liveDot} aria-hidden style={{ width: 6, height: 6 }} />}
          {STATE_LABEL[sprint.state]}
        </span>
      </div>
      <h1
        className={`${ui.titleGradient} ${ui.balance}`}
        style={{ fontSize: "clamp(26px, 5vw, 36px)", fontWeight: 650, letterSpacing: "-0.03em", lineHeight: 1.1 }}
      >
        {sprint.title}
      </h1>
      {sprint.tagline && (
        <p className={ui.balance} style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 8, maxWidth: 640 }}>
          {sprint.tagline}
        </p>
      )}
    </header>
  );
}

/** The theme: sealed until kickoff by the database (theme is NULL until then). */
export function ThemeTile({ sprint }: { sprint: SprintRow }) {
  const sealed = !["live", "judging", "revealed"].includes(sprint.phase);
  if (sprint.theme && sealed) {
    // Only an admin gets the theme before kickoff (private.hackathon_theme).
    return (
      <Tile kicker="The theme · sealed" right="only admins see this" style={{ marginBottom: 16 }} padding="16px 18px">
        <p className={ui.balance} style={{ fontSize: 18, fontWeight: 600, color: "var(--text-secondary)", lineHeight: 1.3 }}>
          {sprint.theme}
        </p>
        <p className={ui.emptySub}>Members see it at kickoff, all at the same moment.</p>
      </Tile>
    );
  }
  if (sprint.theme) {
    return (
      <Tile kicker="The theme" style={{ marginBottom: 16 }} padding="16px 18px">
        <p className={ui.balance} style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: AMBER, lineHeight: 1.25 }}>
          {sprint.theme}
        </p>
      </Tile>
    );
  }
  if (sprint.state === "cancelled" || sprint.phase === "revealed") return null;
  return (
    <Tile kicker="The theme" style={{ marginBottom: 16 }}>
      <p className={ui.emptyTitle}>Revealed at kickoff. Everyone gets it at the same moment.</p>
    </Tile>
  );
}

/** Every milestone in the viewer's time zone, with the ones already past dimmed. */
export function ScheduleTile({ sprint, nowMs }: { sprint: SprintRow; nowMs: number }) {
  const rows: { key: string; at: string | null }[] = [
    ...MILESTONES.map((m) => ({ key: m.key as string, at: sprint[m.key] })),
    ...(sprint.lobby_closes_at ? [{ key: "lobby_closes_at", at: sprint.lobby_closes_at }] : []),
  ].sort((a, b) => (a.at ? Date.parse(a.at) : Infinity) - (b.at ? Date.parse(b.at) : Infinity));
  // Frozen Sprints: past means past on the Sprint's stopped clock.
  const clock = sprint.status_override_at ? Math.min(nowMs, Date.parse(sprint.status_override_at)) : nowMs;
  const nextKey = rows.find((r) => r.at && Date.parse(r.at) > clock)?.key;

  return (
    <Tile kicker="Schedule" style={{ marginBottom: 16 }}>
      <ul className="flex flex-col" style={{ gap: 8 }}>
        {rows.map((r) => {
          const past = r.at ? Date.parse(r.at) <= clock : false;
          const next = r.key === nextKey && sprint.state !== "cancelled";
          return (
            <li key={r.key} className="flex items-baseline justify-between gap-3" style={{ opacity: past ? 0.5 : 1 }}>
              <span style={{ fontSize: 13, color: next ? AMBER : "var(--text-primary)" }}>
                {labelFor(r.key)}
                {r.key === "ends_at" && <span style={{ color: "var(--text-muted)" }}> · submissions lock</span>}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "right" }}>
                <LocalTime iso={r.at} />
              </span>
            </li>
          );
        })}
      </ul>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 10 }}>
        Teams of {sprint.min_team_size === sprint.max_team_size ? sprint.max_team_size : `${sprint.min_team_size}–${sprint.max_team_size}`}.
        Times are in your time zone.
      </p>
    </Tile>
  );
}

export function RulesTile({ sprint }: { sprint: SprintRow }) {
  if (!sprint.rules?.trim()) return null;
  return (
    <Tile kicker="Rules" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13 }}>
        <Markdown source={sprint.rules} />
      </div>
    </Tile>
  );
}

/**
 * Who you are in this Sprint, and what you can do: participants get their
 * team room and the lobby, judges the lobby, spectators a way in.
 */
export function ViewerCallout({ data }: { data: SprintPageData }) {
  const { sprint, viewer, nextSprint } = data;
  const n = sprint.number;
  const phase = sprint.phase;
  const over = sprint.state === "cancelled";

  const lobby = { href: `/hackathon/${n}/lobby`, label: "Lobby" };
  const room = viewer.teamId ? { href: `/hackathon/${n}/team`, label: "My team room" } : null;

  let title: string;
  let body: React.ReactNode = null;
  let links: { href: string; label: string; primary?: boolean }[] = [];

  switch (viewer.role) {
    case "participant":
      title = "You're in this Sprint";
      body = over
        ? "It was cancelled. The lobby stays readable."
        : sprint.state === "paused"
          ? "It's paused, so team rooms and submissions are frozen. The lobby is open."
          : phase === "upcoming" || phase === "registration"
          ? viewer.mode === "team"
            ? room
              ? "You're on a team. Your team room is ready."
              : "You chose to build with your own team."
            : "You're in the random pool. Teams are matched before kickoff."
          : phase === "teams_locked"
            ? "Teams are locked. Kickoff is next."
            : phase === "live"
              ? "It's on. Build, then submit before the deadline."
              : phase === "judging"
                ? "Submissions are closed. The judges are scoring."
                : "Thanks for building.";
      links = [...(room ? [{ ...room, primary: phase === "live" }] : []), lobby];
      break;
    case "judge":
      title = "You're judging this Sprint";
      body =
        phase === "judging"
          ? "Submissions are in. Scoring is open until judging ends."
          : phase === "revealed"
            ? "Judging is done. Thank you."
            : "Scoring opens at the submission deadline.";
      links = [lobby];
      break;
    case "invited_judge":
      title = "You're invited to judge this Sprint";
      body = "Accepting the invitation arrives with the judging tools.";
      break;
    case "outsider":
      title = "You're not in this Sprint";
      body = "Sprints are for active members. Renew your membership to take part in the next one.";
      links = [{ href: "/pricing", label: "See plans", primary: true }];
      break;
    default:
      title = "You're not in this Sprint";
      if (!over && phase === "registration") {
        body = (
          <>
            Registration is open until teams lock
            {sprint.team_lock_at ? (
              <>
                {" "}
                (<LocalTime iso={sprint.team_lock_at} />)
              </>
            ) : null}
            . Join the random pool or bring your own team.
          </>
        );
        links = [{ href: "#join", label: "Register", primary: true }];
      } else if (!over && phase === "upcoming") {
        body = (
          <>
            Registration opens <LocalTime iso={sprint.registration_opens_at} />. Come back then to join.
          </>
        );
      } else if (nextSprint) {
        body = (
          <>
            You can still watch this one. The next Sprint, #{nextSprint.number} {nextSprint.title},{" "}
            {nextSprint.state === "registration" ? "is open for registration now." : <>opens registration <LocalTime iso={nextSprint.registration_opens_at} />.</>}
          </>
        );
        links = [{ href: `/hackathon/${nextSprint.number}`, label: `Sprint #${nextSprint.number}`, primary: true }];
      } else {
        body = "You can still watch this one. The next Sprint will be announced here.";
      }
  }

  if (viewer.isAdmin) links = [...links, { href: "/admin", label: "Manage in admin" }];

  return (
    <Tile style={{ marginBottom: 16 }} padding="14px 16px">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{title}</p>
          {body && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3, lineHeight: 1.55 }}>{body}</p>}
        </div>
        {links.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {links.map((l) =>
              l.primary ? (
                <Link key={l.href} href={l.href} className={ui.primaryBtn} style={{ textDecoration: "none" }}>
                  {l.label}
                </Link>
              ) : (
                <Link key={l.href} href={l.href} className={ui.ghostBtn} style={{ textDecoration: "none" }}>
                  {l.label}
                </Link>
              ),
            )}
          </div>
        )}
      </div>
    </Tile>
  );
}

/** Who's registered so far (migration 024): names only, no mode or team. */
export function RegistrantsTile({ registrants }: { registrants: Registrant[] }) {
  const shown = registrants.slice(0, 48);
  return (
    <Tile kicker="Registered so far" right={`${registrants.length}`} style={{ marginBottom: 16 }}>
      {registrants.length === 0 ? (
        <div className={ui.empty}>
          <p className={ui.emptyTitle}>Nobody yet. Be the first.</p>
        </div>
      ) : (
        <ul className="flex flex-wrap" style={{ gap: "10px 14px" }}>
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-2" style={{ minWidth: 0 }}>
              <PersonAvatar name={p.full_name} stage={p.stage} username={p.username} size={24} />
              <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{(p.full_name ?? "Founder").split(/\s+/)[0]}</span>
            </li>
          ))}
          {registrants.length > shown.length && (
            <li style={{ fontSize: 12.5, color: "var(--text-muted)", alignSelf: "center" }}>
              +{registrants.length - shown.length} more
            </li>
          )}
        </ul>
      )}
    </Tile>
  );
}
