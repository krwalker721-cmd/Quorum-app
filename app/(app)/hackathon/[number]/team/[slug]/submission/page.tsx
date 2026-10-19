import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import NoGrid from "@/components/ui/NoGrid";
import ui from "@/components/ui/sleek.module.css";
import SprintAutoRefresh from "@/components/hackathon/SprintAutoRefresh";
import { StatusBanner } from "@/components/hackathon/SprintSections";
import SubmissionForm from "@/components/hackathon/submission/SubmissionForm";
import { loadSprint } from "@/lib/hackathons/page";
import { getMemberStanding } from "@/lib/hackathons/viewer";
import { TEAM_COLUMNS, roomHref, type RoomTeam } from "@/lib/hackathons/room";
import { SUBMISSION_BUCKET, SUBMISSION_COLUMNS, type SubmissionRow } from "@/lib/hackathons/submission";
import { toTiming } from "@/lib/hackathons/sprint";

export const dynamic = "force-dynamic";

// The team's submission (Phase 8): the same door as the team room (its
// members and admins). Members edit while the Sprint is live; everyone else,
// and everyone after the deadline, reads. The database enforces all of it
// (migrations 020, 030): sealed until the reveal, drafts sealed for good,
// and no member write outside the live window.
export default async function SubmissionPage(props: { params: Promise<{ number: string; slug: string }> }) {
  const { number, slug } = await props.params;
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
  if (!team || (!membership && !standing.isAdmin)) redirect(`/hackathon/${n}?notice=room-private`);

  const [{ data: sub }, { data: memberRows }] = await Promise.all([
    supabase.from("hackathon_submissions").select(SUBMISSION_COLUMNS).eq("team_id", team.id).maybeSingle(),
    supabase.from("hackathon_team_members").select("user_id, role, joined_at").eq("team_id", team.id),
  ]);
  const submission = (sub as unknown as SubmissionRow | null) ?? null;

  const ids = (memberRows ?? []).map((m) => m.user_id as string);
  // Whoever last edited may have left the team since; name them too.
  if (submission?.last_edited_by && !ids.includes(submission.last_edited_by)) ids.push(submission.last_edited_by);
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, full_name, username, stage").in("id", ids)
    : { data: [] };
  const onTeam = new Set((memberRows ?? []).map((m) => m.user_id as string));
  const allPeople = (people ?? []) as { id: string; full_name: string | null; username: string | null; stage: string | null }[];

  // Screenshots are private: the team (and admins) get URLs that expire.
  const paths = submission?.screenshots ?? [];
  const { data: signed } = paths.length
    ? await supabase.storage.from(SUBMISSION_BUCKET).createSignedUrls(paths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urls: Record<string, string> = Object.fromEntries(
    (signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]),
  );

  const isMember = Boolean(membership);
  const live = sprint.state === "live";
  const writable = isMember && live;
  const closedReason = !isMember
    ? "You're viewing this as an admin. Only the team can edit its submission."
    : sprint.state === "paused"
      ? "The Buildathon is paused, so the submission is frozen until it resumes."
      : sprint.state === "cancelled"
        ? "This Buildathon was cancelled."
        : ["registration", "teams_locked"].includes(sprint.state)
          ? "The submission opens at kickoff."
          : "The deadline has passed, so the submission is locked. Here's what was submitted.";

  return (
    <>
      <NoGrid />
      <TopBar sleek title="buildathon" tier={standing.tier} userId={user.id} />
      <SprintAutoRefresh timing={toTiming(sprint)} state={sprint.state} />
      <div className="page-pad" style={{ padding: "16px 26px 48px", maxWidth: 880, margin: "0 auto", width: "100%" }}>
        <Link href={roomHref(n, team.slug)} style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
          ← Team room
        </Link>
        <h1
          className={`${ui.titleGradient} ${ui.balance}`}
          style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15, marginTop: 12 }}
        >
          Submission
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 16 }}>
          Sealed until the reveal. Anyone on {team.name} can edit it until the deadline; it saves as you go.
        </p>
        <StatusBanner sprint={sprint} />
        <SubmissionForm
          sprint={{ id: sprint.id, number: n, endsAt: sprint.ends_at, live }}
          team={{ id: team.id, name: team.name, emblem: team.emblem, color: team.color }}
          members={allPeople.filter((p) => onTeam.has(p.id))}
          everyone={allPeople}
          initial={submission}
          initialUrls={urls}
          writable={writable}
          closedReason={writable ? null : closedReason}
          roomHref={roomHref(n, team.slug)}
        />
      </div>
    </>
  );
}
