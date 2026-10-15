import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import NoGrid from "@/components/ui/NoGrid";
import Tile from "@/components/ui/Tile";
import SprintAutoRefresh from "@/components/hackathon/SprintAutoRefresh";
import SprintCountdown from "@/components/hackathon/SprintCountdown";
import JoinQueue from "@/components/hackathon/JoinQueue";
import TeamPanel from "@/components/hackathon/TeamPanel";
import CheckIn from "@/components/hackathon/CheckIn";
import QueueLive from "@/components/hackathon/QueueLive";
import Arena from "@/components/hackathon/Arena";
import RevealedShowcase from "@/components/hackathon/RevealGallery";
import { SealWatcher } from "@/components/hackathon/showcase/RevealMoment";
import {
  RegistrantsTile,
  RulesTile,
  ScheduleTile,
  LiveExplainer,
  SprintHero,
  SprintOpener,
  TeamProjectCards,
  StatusBanner,
  ThemeTile,
  ViewerCallout,
} from "@/components/hackathon/SprintSections";
import { loadSprint, loadSprintPage, type SprintPageData } from "@/lib/hackathons/page";
import { getMemberStanding } from "@/lib/hackathons/viewer";
import { runMatcherIfDue } from "@/lib/hackathons/matcher";
import { postLobbyMilestones } from "@/lib/hackathons/lobbyMilestones";
import { stageCountdown, toTiming } from "@/lib/hackathons/sprint";
import { hasFeed, loadFeed, type FeedData } from "@/lib/hackathons/feed";
import SprintFeed from "@/components/hackathon/feed/SprintFeed";
import LiveStage from "@/components/hackathon/feed/LiveStage";
import liveCss from "@/components/hackathon/feed/liveStage.module.css";

export const dynamic = "force-dynamic";

// Why someone was sent back here from a team room (?notice=…).
const NOTICES: Record<string, string> = {
  "room-private": "That team room is private to its team. Only its members (and admins) can open it.",
  "no-team": "You're not on a team in this Sprint, so there's no team room for you.",
  "lobby-private": "The lobby is for the people in this Sprint: its participants, judges and admins.",
  "judging-private": "Judging is for this Sprint's judges. Admins see every score in the admin console.",
  "judge-accept-first": "Accept your invitation to judge first, then the judging view opens.",
};

// One page for a Sprint in every state. The database derives the state
// (hackathon_overview); this page only chooses the layout for it, and
// SprintAutoRefresh reloads it when the state changes or an admin moves a time.
export default async function SprintPage(props: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ notice?: string; mockTeams?: string }>;
}) {
  const [{ number }, { notice, mockTeams }] = await Promise.all([props.params, props.searchParams]);
  // Development only: ?mockTeams=N adds made-up teams to the live arena map.
  const mock = process.env.NODE_ENV === "development" ? Math.min(200, Math.max(0, Number(mockTeams) || 0)) : 0;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [standing, found] = await Promise.all([getMemberStanding(supabase, user.id), loadSprint(supabase, n)]);
  // RLS: unpublished Sprints exist only for admins.
  if (!found) notFound();
  let sprint = found;

  // Teams have locked: make sure the matcher has run (once only, so this is
  // cheap after the first time), then read the Sprint again with its teams.
  if (sprint.state === "teams_locked" || sprint.state === "live") {
    await runMatcherIfDue(sprint.id);
    sprint = (await loadSprint(supabase, n)) ?? sprint;
  }

  // The lobby's milestone messages (once each; the database keeps count).
  if (sprint.is_published) await postLobbyMilestones(sprint.id);

  const data = await loadSprintPage(supabase, sprint, user.id, standing);
  const feed = hasFeed(sprint) ? await loadFeed(supabase, sprint, data.viewer, data.teams) : null;
  // While it's live (paused included) the page is the feed, the projects and
  // the stadium; before and after, the main column leads and the feed follows.
  const liveLayout = sprint.phase === "live" && sprint.state !== "cancelled";
  const timing = toTiming(sprint);
  const stage = stageCountdown(sprint.state);
  // Before kickoff, the page opens by saying what a Sprint is.
  const opener = sprint.state === "upcoming" || sprint.state === "registration";

  return (
    <>
      <NoGrid />
      <TopBar sleek title="buildathon" tier={standing.tier} userId={user.id} />
      <SprintAutoRefresh timing={timing} state={sprint.state} />
      {sprint.state === "registration" && <QueueLive sprintId={sprint.id} />}

      <div className="page-pad" style={{ padding: "18px 26px 48px", maxWidth: 1120, margin: "0 auto", width: "100%" }}>
        <div className="flex items-center justify-between gap-3" style={{ marginBottom: 12 }}>
          <Link href="/hackathon" style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
            ← Buildathon
          </Link>
          <Link href="/hackathon/archive" style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
            All Sprints →
          </Link>
        </div>

        {notice && NOTICES[notice] && (
          <p
            role="status"
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              background: "rgba(255, 255, 255, 0.03)",
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 16,
            }}
          >
            {NOTICES[notice]}
          </p>
        )}
        <StatusBanner sprint={sprint} />
        <SprintHero sprint={sprint} />
        {opener && <SprintOpener data={data} />}

        {stage && (
          <Tile
            gradient={stage.big}
            style={{ marginBottom: 16 }}
            padding={stage.big ? "28px 16px 24px" : "16px 18px"}
          >
            <SprintCountdown state={sprint.state} timing={timing} />
          </Tile>
        )}

        {liveLayout && <LiveExplainer sprint={sprint} teamCount={data.teams.length} />}

        {/* The opener speaks to members who haven't joined; everyone else keeps their callout. */}
        {sprint.state !== "draft" && !(opener && data.viewer.role === "spectator") && <ViewerCallout data={data} />}

        {sprint.state === "live" && data.viewer.role === "participant" && (
          <Tile style={{ marginBottom: 16 }} padding="14px 16px">
            <CheckIn sprintId={sprint.id} checkedInAt={data.viewer.checkedInAt} />
          </Tile>
        )}

        {liveLayout ? (
          <>
            {/* The stage: the stadium, with the Sprint chat in a drawer beside it. */}
            <LiveStage
              arena={
                <Arena
                  sprintId={sprint.id}
                  sprintNumber={sprint.number}
                  live
                  teams={data.teams}
                  phase="live"
                  myTeamId={data.viewer.teamId}
                  map={{ label: "Submissions close in", at: sprint.ends_at, theme: sprint.theme }}
                  mockTeams={mock}
                  fill
                />
              }
              chat={feed ? <Feed data={data} feed={feed} userId={user.id} /> : null}
            />

            <section aria-label="About this Sprint">
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>About this Sprint</h2>
              <div className={liveCss.row}>
                <MyTeamPanel data={data} />
                <ScheduleTile sprint={sprint} nowMs={Date.now()} />
                <RulesTile sprint={sprint} />
              </div>
            </section>

            {/* Last: every team, as Collab-style project cards. */}
            <div style={{ marginTop: 28 }}>
              <TeamProjectCards teams={data.teams} myTeamId={data.viewer.teamId} sprintNumber={sprint.number} grid />
            </div>
          </>
        ) : (
          <div className="grid stack-md" style={{ gap: 16, gridTemplateColumns: "minmax(0, 1fr) 320px", alignItems: "start" }}>
            <div style={{ minWidth: 0 }}>
              <MainColumn data={data} />
              {feed && <Feed data={data} feed={feed} userId={user.id} />}
            </div>
            <aside style={{ minWidth: 0 }}>
              <ScheduleTile sprint={sprint} nowMs={Date.now()} />
              {sprint.phase !== "upcoming" && sprint.phase !== "draft" && <RulesTile sprint={sprint} />}
            </aside>
          </div>
        )}
      </div>
    </>
  );
}

/** The part that changes most from state to state. Each block is its own file for later prompts. */
/** The Sprint's feed (034), wherever the layout puts it. */
function Feed({ data, feed, userId }: { data: SprintPageData; feed: FeedData; userId: string }) {
  const { sprint, viewer } = data;
  return (
    <SprintFeed
      sprint={{ id: sprint.id, number: sprint.number, endsAt: sprint.ends_at, lobbyClosesAt: sprint.lobby_closes_at, frozen: Boolean(sprint.status_override) }}
      initialMessages={feed.messages}
      initialSubmissions={feed.submissions}
      welcome={feed.welcome}
      initialPeople={feed.people}
      viewerId={userId}
      isAdmin={viewer.isAdmin}
      canPost={feed.canPost}
      closedReason={feed.closedReason}
    />
  );
}

/** Your team's panel (members, renaming, invites), from registration through the live Sprint. */
function MyTeamPanel({ data }: { data: SprintPageData }) {
  const { sprint, viewer, teams, queue } = data;
  const mine = viewer.teamId ? teams.find((t) => t.id === viewer.teamId) : undefined;
  if (!mine || !queue?.team) return null;
  return (
    <TeamPanel
      sprint={{ id: sprint.id, number: sprint.number, phase: sprint.phase, frozen: sprint.state === "paused" }}
      team={mine}
      panel={queue.team}
      viewerId={viewer.userId}
    />
  );
}

function MainColumn({ data }: { data: SprintPageData }) {
  const { sprint, viewer, teams, registrants, showcase, queue } = data;
  const myTeam = viewer.teamId;
  const mine = myTeam ? teams.find((t) => t.id === myTeam) : undefined;
  // The pulse is live while teams can still be busy.
  const pulseLive = ["teams_locked", "live", "judging"].includes(sprint.state);
  const teamPanel =
    mine && queue?.team ? (
      <TeamPanel
        sprint={{ id: sprint.id, number: sprint.number, phase: sprint.phase, frozen: sprint.state === "paused" }}
        team={mine}
        panel={queue.team}
        viewerId={viewer.userId}
      />
    ) : null;

  if (sprint.state === "cancelled") {
    return teams.length > 0 ? <Arena sprintId={sprint.id} sprintNumber={sprint.number} live={pulseLive} teams={teams} phase={sprint.phase} myTeamId={myTeam} title="Teams" /> : null;
  }

  switch (sprint.phase) {
    case "draft":
    case "upcoming":
      return (
        <>
          <ThemeTile sprint={sprint} />
          <RulesTile sprint={sprint} />
        </>
      );
    case "registration":
      return (
        <>
          <JoinQueue sprint={sprint} viewer={viewer} teams={teams} queue={queue} />
          {teamPanel}
          {registrants && <RegistrantsTile registrants={registrants} />}
          <Arena sprintId={sprint.id} sprintNumber={sprint.number} live={pulseLive} teams={teams} phase="registration" myTeamId={myTeam} title="Teams so far" collapseAfter={4} />
        </>
      );
    case "teams_locked":
      return (
        <>
          {teamPanel}
          <Arena sprintId={sprint.id} sprintNumber={sprint.number} live={pulseLive} teams={teams} phase="teams_locked" myTeamId={myTeam} title="Final teams" />
          <ThemeTile sprint={sprint} />
        </>
      );
    case "live":
      // The live layout is the page's own (feed, projects, stadium).
      return null;
    case "judging":
      return (
        <>
          {/* Whoever is here when it turns over gets the reveal moment (Phase 10). */}
          {sprint.state === "judging" && <SealWatcher sprintNumber={sprint.number} />}
          <ThemeTile sprint={sprint} />
          <Arena sprintId={sprint.id} sprintNumber={sprint.number} live={pulseLive} teams={teams} phase="judging" myTeamId={myTeam} />
        </>
      );
    case "revealed":
      return (
        <>
          <RevealedShowcase sprintNumber={sprint.number} revealAt={sprint.reveal_at!} teams={teams} projects={showcase} />
          <ThemeTile sprint={sprint} />
          <Arena sprintId={sprint.id} sprintNumber={sprint.number} live={pulseLive} teams={teams} phase="revealed" myTeamId={myTeam} title="Teams" />
        </>
      );
  }
}
