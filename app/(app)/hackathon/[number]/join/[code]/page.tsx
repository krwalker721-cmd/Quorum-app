import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import NoGrid from "@/components/ui/NoGrid";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";
import JoinByLink from "@/components/hackathon/JoinByLink";
import LocalTime from "@/components/hackathon/LocalTime";
import { TeamBadge } from "@/components/hackathon/TeamStyle";
import { loadSprint } from "@/lib/hackathons/page";
import { getMemberStanding } from "@/lib/hackathons/viewer";

export const dynamic = "force-dynamic";

type Preview = {
  team_id: string;
  team_name: string;
  emblem: string | null;
  color: string | null;
  hackathon_number: number;
  member_count: number;
  max_size: number;
};

// A team's invite link (migration 025). Shows the team, then one button that
// registers you if needed and puts you on it. The database decides whether
// that's allowed (registration open, active member, room on the team).
export default async function JoinLinkPage(props: { params: Promise<{ number: string; code: string }> }) {
  const { number, code } = await props.params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [standing, sprint, preview, mine, regs] = await Promise.all([
    getMemberStanding(supabase, user.id),
    loadSprint(supabase, n),
    supabase.rpc("hackathon_team_by_code", { p_code: code }).maybeSingle(),
    supabase.from("hackathon_team_members").select("team_id, hackathon_id").eq("user_id", user.id),
    supabase.from("hackathon_registrations").select("hackathon_id").eq("user_id", user.id).is("withdrawn_at", null),
  ]);
  const team = preview.data as Preview | null;
  const valid = !!sprint && !!team && team.hackathon_number === n;
  const myTeamHere = valid ? (mine.data ?? []).find((m) => m.hackathon_id === sprint!.id)?.team_id : undefined;

  let message: string | null = null;
  if (!valid) message = "This invite link isn't valid any more. Ask the team for a new one.";
  else if (myTeamHere === team!.team_id) message = "You're already on this team.";
  else if (myTeamHere) message = "You're already on a team in this Buildathon. Leave it first to join this one.";
  else if (sprint!.state !== "registration") message = "Teams are locked for this Buildathon, so the link no longer works.";
  // Someone already registered keeps their access even if their trial ends (decision 12).
  else if (!standing.isActive && !(regs.data ?? []).some((r) => r.hackathon_id === sprint!.id))
    message = "Joining a Buildathon needs an active membership.";
  else if (team!.member_count >= team!.max_size) message = "This team is full.";

  return (
    <>
      <NoGrid />
      <TopBar sleek title="buildathon" tier={standing.tier} userId={user.id} />
      <div className="page-pad" style={{ padding: "24px 26px 48px", maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <Tile padding="20px 20px">
          {valid ? (
            <>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                Buildathon #{sprint!.number}
              </p>
              <div className="flex items-center gap-3" style={{ marginTop: 12 }}>
                <TeamBadge name={team!.team_name} emblem={team!.emblem} color={team!.color} size={40} />
                <div>
                  <h1 className={ui.titleGradient} style={{ fontSize: 24, fontWeight: 650, letterSpacing: "-0.02em" }}>
                    {team!.team_name}
                  </h1>
                  <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    {team!.member_count} of {team!.max_size} · you&rsquo;ve been invited to join
                  </p>
                </div>
              </div>
              <div style={{ marginTop: 18 }}>
                {message ? (
                  <p className={ui.emptyTitle}>{message}</p>
                ) : (
                  <>
                    <JoinByLink code={code} teamName={team!.team_name} sprintNumber={n} />
                    {sprint!.team_lock_at && (
                      <p className={ui.emptySub} style={{ marginTop: 10 }}>
                        This registers you for the Buildathon if you haven&rsquo;t already. Teams lock <LocalTime iso={sprint!.team_lock_at} />.
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <p className={ui.emptyTitle}>{message}</p>
          )}
          <p style={{ marginTop: 18 }}>
            {/* A link to a deleted Sprint goes back to the tab, not to a 404. */}
            <Link href={sprint ? `/hackathon/${n}` : "/hackathon"} style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
              {sprint ? `See Buildathon #${n} →` : "Go to Buildathons →"}
            </Link>
          </p>
        </Tile>
      </div>
    </>
  );
}
