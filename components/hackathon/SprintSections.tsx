import Link from "next/link";
import Tile from "@/components/ui/Tile";
import ShowMore from "./ShowMore";
import PersonAvatar from "@/components/ui/PersonAvatar";
import Markdown from "@/components/Markdown";
import ui from "@/components/ui/sleek.module.css";
import { MILESTONES, labelFor } from "@/lib/hackathons/timeline";
import { STATE_LABEL, type SprintRow } from "@/lib/hackathons/sprint";
import type { ArenaTeam, Registrant, SprintPageData } from "@/lib/hackathons/page";
import { timeAgo } from "@/lib/stage";
import { TeamBadge } from "./TeamStyle";
import LocalTime from "./LocalTime";
import AcceptJudgeInvite from "./judging/AcceptJudgeInvite";

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

/**
 * What this Sprint is, before anyone has to decide: shown while it's announced
 * and while registration is open. Plain facts, the real dates, and (for a
 * member who hasn't joined) the one Register button, which leads to the join
 * queue (#join).
 */
export function SprintOpener({ data }: { data: SprintPageData }) {
  const { sprint, viewer } = data;
  const open = sprint.state === "registration";
  const canJoin = open && viewer.role === "spectator";
  const dates: { label: string; iso: string | null }[] = [
    { label: open ? "Sign-ups close" : "Registration opens", iso: open ? sprint.team_lock_at : sprint.registration_opens_at },
    { label: "Kickoff", iso: sprint.starts_at },
    { label: "Submissions close", iso: sprint.ends_at },
    { label: "Reveal", iso: sprint.reveal_at },
  ];
  const points = [
    {
      title: "What you commit to",
      text: `48 hours from kickoff, with a team of ${sprint.min_team_size} to ${sprint.max_team_size}. You work in a private team room and submit a working project (its name, the problem and a demo) before the deadline. The form locks on the dot.`,
    },
    {
      title: "How teams form",
      text: "Register alone and you go into the random pool: anyone without a team is matched when teams lock. Or start a team and invite people, or ask to join one that's open.",
    },
    {
      title: "What happens to your work",
      text: "Every project stays sealed until the reveal. Judges score the finished ones on the problem, what shipped, how the team worked and its potential. Then awards go out and each project gets a public page.",
    },
  ];
  return (
    <Tile kicker="What this is" style={{ marginBottom: 16 }} padding="16px 18px 18px">
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text-primary)", maxWidth: 720 }}>
        A 48-hour build with founders from across the network. You join a team, get the theme at kickoff, and ship
        something new before the clock runs out.
      </p>
      <dl
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 14 }}
      >
        {dates.map((d) => (
          <div key={d.label} style={{ border: "1px solid rgba(255, 255, 255, 0.07)", borderRadius: 10, padding: "9px 12px" }}>
            <dt style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{d.label}</dt>
            <dd style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>{d.iso ? <LocalTime iso={d.iso} /> : "To be set"}</dd>
          </div>
        ))}
      </dl>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px 22px", marginTop: 16 }}>
        {points.map((pt) => (
          <div key={pt.title}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{pt.title}</p>
            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-secondary)", marginTop: 4 }}>{pt.text}</p>
          </div>
        ))}
      </div>
      {(canJoin || viewer.isAdmin || (!open && viewer.role === "spectator")) && (
        <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 18 }}>
          {canJoin && (
            <Link href="#join" className={ui.primaryBtn} style={{ textDecoration: "none" }}>
              Register
            </Link>
          )}
          {!open && viewer.role === "spectator" && sprint.registration_opens_at && (
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              Registration opens <LocalTime iso={sprint.registration_opens_at} />.
            </span>
          )}
          {viewer.isAdmin && (
            <Link href="/admin" className={ui.ghostBtn} style={{ textDecoration: "none" }}>
              Manage in admin
            </Link>
          )}
        </div>
      )}
    </Tile>
  );
}

/**
 * The live Sprint's "what this is": the format in one line, then the theme,
 * the deadline and the reveal, with the rules a click away. Shorter than the
 * opener before kickoff: by now people are here to watch or build.
 */
export function LiveExplainer({ sprint, teamCount }: { sprint: SprintRow; teamCount: number }) {
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "Theme", value: sprint.theme ?? "Revealed at kickoff" },
    { label: "Submissions close", value: sprint.ends_at ? <LocalTime iso={sprint.ends_at} /> : "To be set" },
    { label: "Reveal", value: sprint.reveal_at ? <LocalTime iso={sprint.reveal_at} /> : "To be set" },
  ];
  return (
    <Tile kicker="What this is" style={{ marginBottom: 16 }} padding="14px 18px 16px">
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)", maxWidth: 760 }}>
        {`A 48-hour build. ${teamCount} team${teamCount === 1 ? " is" : "s are"} making something new from scratch around the theme, in private rooms.`}{" "}
        Every project stays sealed until the reveal, when the judges&rsquo; awards go out
        and each project gets a public page.{" "}
        {sprint.rules?.trim() && (
          <a href="#rules" style={{ color: "var(--text-muted)", textDecoration: "none", whiteSpace: "nowrap" }}>
            The rules ↓
          </a>
        )}
      </p>
      <dl className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 12 }}>
        {facts.map((f) => (
          <div key={f.label} style={{ border: "1px solid rgba(255, 255, 255, 0.07)", borderRadius: 10, padding: "9px 12px" }}>
            <dt style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{f.label}</dt>
            <dd style={{ fontSize: 13, color: f.label === "Theme" ? AMBER : "var(--text-primary)", marginTop: 2, fontWeight: f.label === "Theme" ? 600 : 400 }}>
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </Tile>
  );
}

/**
 * The teams as Collab-board project cards (live): who's building, how busy
 * they are, sealed or submitted. Your team first, with the way into its room.
 */
export function TeamProjectCards({
  teams,
  myTeamId,
  sprintNumber,
  grid = false,
}: {
  teams: ArenaTeam[];
  myTeamId: string | null;
  sprintNumber: number;
  /** A full-width grid, like the Collab board (otherwise one column). */
  grid?: boolean;
}) {
  const ordered = [...teams].sort((a, b) => (a.id === myTeamId ? -1 : b.id === myTeamId ? 1 : a.name.localeCompare(b.name)));
  return (
    <section aria-label="Projects" style={{ marginBottom: 16 }}>
      <div className="flex items-baseline justify-between gap-3" style={{ marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Projects</h2>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{teams.length} building</span>
      </div>
      {teams.length === 0 ? (
        <Tile>
          <p className={ui.emptyTitle}>No teams in this Sprint.</p>
        </Tile>
      ) : (
        <ShowMore
          limit={grid ? 9 : 6}
          noun="projects"
          className={grid ? "grid" : "flex flex-col"}
          style={grid ? { gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" } : { gap: 10 }}
        >
          {ordered.map((t) => {
            const mine = t.id === myTeamId;
            const done = t.pulse?.has_submitted;
            const active = t.pulse?.last_active_at;
            return (
              <li key={t.id}>
                <article className={ui.tile} style={{ padding: "13px 15px", ...(mine ? { borderColor: "rgba(245, 158, 11, 0.5)" } : {}) }}>
                  <div className="flex items-center gap-2.5">
                    <TeamBadge name={t.name} emblem={t.emblem} color={t.color} size={30} />
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                        {t.name}
                      </p>
                      <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        {t.members.length} builder{t.members.length === 1 ? "" : "s"}
                        {t.is_random_matched ? " · matched" : ""}
                      </p>
                    </div>
                    {mine && <span className={`${ui.chip} ${ui.chipAmber}`} style={{ marginLeft: "auto" }}>Your team</span>}
                  </div>
                  <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
                    <span className="flex">
                      {t.members.slice(0, 5).map((m, i) => (
                        <span key={m.id} style={{ marginLeft: i ? -6 : 0, borderRadius: 999, boxShadow: "0 0 0 2px var(--bg-surface)", lineHeight: 0 }}>
                          <PersonAvatar name={m.full_name} stage={m.stage} username={m.username} size={22} />
                        </span>
                      ))}
                    </span>
                    <span className="truncate" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {t.members.map((m) => (m.full_name ?? "Founder").split(/\s+/)[0]).join(", ")}
                    </span>
                  </div>
                  <div className={`${ui.cardFoot} flex items-center justify-between gap-3 flex-wrap`}>
                    <span style={{ fontSize: 11.5, color: done ? "#22c55e" : "var(--text-muted)" }}>
                      {done ? "Submitted ✓ · sealed until the reveal" : `Sealed · ${active ? `active ${timeAgo(active)} ago` : "no activity yet"}`}
                    </span>
                    {mine && (
                      <Link href={`/hackathon/${sprintNumber}/team/${t.slug}`} className={ui.softBtn} style={{ textDecoration: "none" }}>
                        Open team room →
                      </Link>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ShowMore>
      )}
    </section>
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
    <Tile kicker="Rules" style={{ marginBottom: 16, scrollMarginTop: 80 }}>
      <div id="rules" style={{ fontSize: 13 }}>
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
  const { sprint, viewer, nextSprint, judging } = data;
  const n = sprint.number;
  const phase = sprint.phase;
  const over = sprint.state === "cancelled";

  // The feed is on this page now (034); the old lobby page redirects here.
  const lobby = { href: "#feed", label: "Feed" };
  const room = viewer.teamId ? { href: `/hackathon/${n}/team`, label: "My team room" } : null;

  let title: string;
  let body: React.ReactNode = null;
  let links: { href: string; label: string; primary?: boolean }[] = [];
  let action: React.ReactNode = null;

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
    case "judge": {
      title = "You're judging this Sprint";
      const progress = judging && judging.total > 0 ? ` You've scored ${judging.scored} of ${judging.total}.` : "";
      body = over
        ? "It was cancelled, so there's nothing to judge."
        : sprint.state === "paused"
          ? "It's paused, so scoring is frozen until it resumes."
          : phase === "judging"
            ? judging && judging.total === 0
              ? "Submissions are closed, and no team finished one."
              : "Submissions are in." + progress
            : phase === "revealed"
              ? "Judging is done. Thank you." + progress
              : "Scoring opens at the submission deadline. The projects appear in your judging view then.";
      const judgeLink = {
        href: `/hackathon/${n}/judge`,
        label: phase === "judging" && judging && judging.scored < judging.total ? (judging.scored === 0 ? "Start judging" : "Keep judging") : "Judging",
        primary: phase === "judging" && !over && sprint.state !== "paused",
      };
      links = [judgeLink, lobby];
      break;
    }
    case "invited_judge":
      title = "You're invited to judge this Sprint";
      body = over
        ? "It was cancelled."
        : "Judges score the finished projects with a short rubric once submissions close. Judges can't also compete in this Sprint.";
      if (!over) action = <AcceptJudgeInvite sprintId={sprint.id} />;
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
        {(links.length > 0 || action) && (
          <div className="flex items-center gap-2 flex-wrap">
            {action}
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
  return (
    <Tile kicker="Registered so far" right={`${registrants.length}`} style={{ marginBottom: 16 }}>
      {registrants.length === 0 ? (
        <div className={ui.empty}>
          <p className={ui.emptyTitle}>Nobody yet. Be the first.</p>
        </div>
      ) : (
        <ShowMore limit={12} noun="people" className="flex flex-wrap" style={{ gap: "10px 14px" }}>
          {registrants.map((p) => (
            <li key={p.id} className="flex items-center gap-2" style={{ minWidth: 0 }}>
              <PersonAvatar name={p.full_name} stage={p.stage} username={p.username} size={24} />
              <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{(p.full_name ?? "Founder").split(/\s+/)[0]}</span>
            </li>
          ))}
        </ShowMore>
      )}
    </Tile>
  );
}
