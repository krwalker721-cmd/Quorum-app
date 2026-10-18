import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import NoGrid from "@/components/ui/NoGrid";
import SprintAutoRefresh from "@/components/hackathon/SprintAutoRefresh";
import { StatusBanner } from "@/components/hackathon/SprintSections";
import TeamRoomClient from "@/components/hackathon/room/TeamRoomClient";
import type { TeamFeedback } from "@/components/hackathon/room/RoomSide";
import { loadSprint } from "@/lib/hackathons/page";
import { getMemberStanding } from "@/lib/hackathons/viewer";
import { TEAM_COLUMNS, loadRoom, type RoomTeam } from "@/lib/hackathons/room";
import { toTiming } from "@/lib/hackathons/sprint";

export const dynamic = "force-dynamic";

// A team's private room: thread, docs, links and votes. Only the team's
// members and admins get in. The database seals the room regardless (RLS on
// every room table, migration 019); this check is so everyone else gets a
// friendly word on the Sprint page instead of an empty room.
//
// Members write until the reveal (decision 12) while the Sprint isn't paused
// or cancelled; afterwards the room is theirs to read, for good. Admins read.
export default async function TeamRoomPage(props: {
  params: Promise<{ number: string; slug: string }>;
  searchParams: Promise<{ tab?: string; previewFeedback?: string }>;
}) {
  const [{ number, slug }, { tab, previewFeedback }] = await Promise.all([props.params, props.searchParams]);
  // Development only: ?previewFeedback=1 shows mock peer-review feedback (036).
  const previewing = process.env.NODE_ENV === "development" && previewFeedback === "1";
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [standing, sprint] = await Promise.all([getMemberStanding(supabase, user.id), loadSprint(supabase, n)]);
  if (!sprint) notFound();

  const { data: teamRow } = await supabase
    .from("hackathon_teams")
    .select(TEAM_COLUMNS)
    .eq("hackathon_id", sprint.id)
    .eq("slug", slug)
    .maybeSingle();
  const team = teamRow as RoomTeam | null;

  const { data: membership } = team
    ? await supabase.from("hackathon_team_members").select("role").eq("team_id", team.id).eq("user_id", user.id).maybeSingle()
    : { data: null };
  const isMember = Boolean(membership);

  if (!team || (!isMember && !standing.isAdmin)) {
    redirect(`/hackathon/${n}?notice=room-private`);
  }

  const revealed = sprint.phase === "revealed" && sprint.state !== "cancelled";
  const [room, { data: reg }, { data: feedbackRows }] = await Promise.all([
    loadRoom(supabase, team),
    supabase
      .from("hackathon_registrations")
      .select("checked_in_at")
      .eq("hackathon_id", sprint.id)
      .eq("user_id", user.id)
      .is("withdrawn_at", null)
      .maybeSingle(),
    // After the reveal: what fellow builders said, anonymously (036).
    revealed ? supabase.rpc("hackathon_team_feedback", { p_team_id: team.id }) : Promise.resolve({ data: null }),
  ]);
  // Writable on the database's terms (private.can_write_team_room); the
  // database refuses anything else regardless.
  const open = ["registration", "teams_locked", "live", "judging"].includes(sprint.state);

  return (
    <>
      <NoGrid />
      <TopBar sleek title="buildathon" tier={standing.tier} userId={user.id} />
      <SprintAutoRefresh timing={toTiming(sprint)} state={sprint.state} />
      <div className="page-pad" style={{ padding: "16px 26px 40px", maxWidth: 1280, margin: "0 auto", width: "100%" }}>
        <StatusBanner sprint={sprint} />
        <TeamRoomClient
          sprint={{
            id: sprint.id,
            number: sprint.number,
            state: sprint.state,
            phase: sprint.phase,
            theme: sprint.theme,
            rules: sprint.rules,
            timing: toTiming(sprint),
          }}
          room={room}
          viewerId={user.id}
          isMember={isMember}
          writable={isMember && open}
          initialTab={tab}
          checkedInAt={(reg as { checked_in_at: string | null } | null)?.checked_in_at ?? null}
          feedback={previewing ? PREVIEW_FEEDBACK : revealed ? ((feedbackRows ?? []) as TeamFeedback[]) : null}
        />
      </div>
    </>
  );
}

/** Development only: what a team's feedback looks like after the reveal. */
const PREVIEW_FEEDBACK: TeamFeedback[] = [
  { strength: "The calendar move is genuinely clever.", suggestion: "Show what happens on a day with no free windows.", score_problem: 5, score_works: 4, score_use: 5, completed_at: new Date().toISOString() },
  { strength: "I'd use this tonight.", suggestion: null, score_problem: 4, score_works: 4, score_use: 5, completed_at: new Date().toISOString() },
  { strength: null, suggestion: "Let me pick my own focus hours too.", score_problem: 5, score_works: 3, score_use: 4, completed_at: new Date().toISOString() },
  { strength: "Clean, calm design.", suggestion: "A quick tour on first open would help.", score_problem: 4, score_works: 5, score_use: 4, completed_at: new Date().toISOString() },
];
