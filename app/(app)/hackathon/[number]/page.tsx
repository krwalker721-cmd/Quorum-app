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
import { Awards, GallerySlot } from "@/components/hackathon/RevealGallery";
import {
  RegistrantsTile,
  RulesTile,
  ScheduleTile,
  SprintHero,
  StatusBanner,
  ThemeTile,
  ViewerCallout,
} from "@/components/hackathon/SprintSections";
import { loadSprint, loadSprintPage, type SprintPageData } from "@/lib/hackathons/page";
import { getMemberStanding } from "@/lib/hackathons/viewer";
import { runMatcherIfDue } from "@/lib/hackathons/matcher";
import { stageCountdown, toTiming } from "@/lib/hackathons/sprint";

export const dynamic = "force-dynamic";

// One page for a Sprint in every state. The database derives the state
// (hackathon_overview); this page only chooses the layout for it, and
// SprintAutoRefresh reloads it when the state changes or an admin moves a time.
export default async function SprintPage(props: { params: Promise<{ number: string }> }) {
  const { number } = await props.params;
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

  const data = await loadSprintPage(supabase, sprint, user.id, standing);
  const timing = toTiming(sprint);
  const stage = stageCountdown(sprint.state);

  return (
    <>
      <NoGrid />
      <TopBar sleek title="hackathon" tier={standing.tier} userId={user.id} />
      <SprintAutoRefresh timing={timing} state={sprint.state} />
      {sprint.state === "registration" && <QueueLive sprintId={sprint.id} />}

      <div className="page-pad" style={{ padding: "18px 26px 48px", maxWidth: 1120, margin: "0 auto", width: "100%" }}>
        <div className="flex items-center justify-between gap-3" style={{ marginBottom: 12 }}>
          <Link href="/hackathon/archive" style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
            All Sprints →
          </Link>
        </div>

        <StatusBanner sprint={sprint} />
        <SprintHero sprint={sprint} />

        {stage && (
          <Tile
            gradient={stage.big}
            style={{ marginBottom: 16 }}
            padding={stage.big ? "28px 16px 24px" : "16px 18px"}
          >
            <SprintCountdown state={sprint.state} timing={timing} />
          </Tile>
        )}

        {sprint.state !== "draft" && <ViewerCallout data={data} />}

        {sprint.state === "live" && data.viewer.role === "participant" && (
          <Tile style={{ marginBottom: 16 }} padding="14px 16px">
            <CheckIn sprintId={sprint.id} checkedInAt={data.viewer.checkedInAt} />
          </Tile>
        )}

        <div className="grid stack-md" style={{ gap: 16, gridTemplateColumns: "minmax(0, 1fr) 320px", alignItems: "start" }}>
          <div style={{ minWidth: 0 }}>
            <MainColumn data={data} />
          </div>
          <aside style={{ minWidth: 0 }}>
            <ScheduleTile sprint={sprint} nowMs={Date.now()} />
            {sprint.phase !== "upcoming" && sprint.phase !== "draft" && <RulesTile sprint={sprint} />}
          </aside>
        </div>
      </div>
    </>
  );
}

/** The part that changes most from state to state. Each block is its own file for later prompts. */
function MainColumn({ data }: { data: SprintPageData }) {
  const { sprint, viewer, teams, registrants, awards, queue } = data;
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
          <Arena sprintId={sprint.id} sprintNumber={sprint.number} live={pulseLive} teams={teams} phase="registration" myTeamId={myTeam} title="Teams so far" />
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
      return (
        <>
          <ThemeTile sprint={sprint} />
          {teamPanel}
          <Arena sprintId={sprint.id} sprintNumber={sprint.number} live={pulseLive} teams={teams} phase="live" myTeamId={myTeam} />
        </>
      );
    case "judging":
      return (
        <>
          <ThemeTile sprint={sprint} />
          <Arena sprintId={sprint.id} sprintNumber={sprint.number} live={pulseLive} teams={teams} phase="judging" myTeamId={myTeam} />
        </>
      );
    case "revealed":
      return (
        <>
          <Awards awards={awards} />
          <GallerySlot />
          <ThemeTile sprint={sprint} />
          <Arena sprintId={sprint.id} sprintNumber={sprint.number} live={pulseLive} teams={teams} phase="revealed" myTeamId={myTeam} title="Teams" />
        </>
      );
  }
}
