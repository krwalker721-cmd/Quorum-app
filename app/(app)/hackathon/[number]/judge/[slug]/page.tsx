import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import NoGrid from "@/components/ui/NoGrid";
import SprintAutoRefresh from "@/components/hackathon/SprintAutoRefresh";
import { StatusBanner } from "@/components/hackathon/SprintSections";
import ProjectShowcase, { type ShowcasePerson } from "@/components/hackathon/showcase/ProjectShowcase";
import ScorePanel from "@/components/hackathon/judging/ScorePanel";
import { loadSprint } from "@/lib/hackathons/page";
import { getMemberStanding } from "@/lib/hackathons/viewer";
import { toTiming } from "@/lib/hackathons/sprint";
import { SUBMISSION_BUCKET, SUBMISSION_COLUMNS, fieldsOf, type SubmissionRow } from "@/lib/hackathons/submission";
import { judgeHref, judgeStatus, loadJudgeQueue } from "@/lib/hackathons/judging";

export const dynamic = "force-dynamic";

// One project, as a judge sees it (Phase 9): the showcase the public gets at
// the reveal, beside the score panel. Read with the judge's own client, so
// RLS decides: a complete submission from the deadline, its screenshots, the
// team, and the team's activity counts. Never anything from the team room.
export default async function JudgeProjectPage(props: { params: Promise<{ number: string; slug: string }> }) {
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
  const status = await judgeStatus(supabase, sprint.id, user.id);
  if (status === "invited") redirect(`/hackathon/${n}?notice=judge-accept-first`);
  if (status !== "judge") redirect(`/hackathon/${n}?notice=judging-private`);

  const { projects, scores } = await loadJudgeQueue(supabase, sprint.id, user.id);
  const index = projects.findIndex((p) => p.team.slug === slug);
  // Not a team, no complete submission, or before the deadline: back to the list.
  if (index === -1) redirect(judgeHref(n));
  const project = projects[index];

  const [{ data: sub }, { data: memberRows }, { data: activity }] = await Promise.all([
    supabase.from("hackathon_submissions").select(SUBMISSION_COLUMNS).eq("id", project.id).maybeSingle(),
    supabase.from("hackathon_team_members").select("user_id").eq("team_id", project.team_id),
    supabase.rpc("get_team_activity", { p_hackathon_id: sprint.id }),
  ]);
  if (!sub) redirect(judgeHref(n));
  const submission = sub as unknown as SubmissionRow;

  const ids = (memberRows ?? []).map((m) => m.user_id as string);
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, full_name, username, stage").in("id", ids)
    : { data: [] };

  const paths = submission.screenshots ?? [];
  const { data: signed } = paths.length
    ? await supabase.storage.from(SUBMISSION_BUCKET).createSignedUrls(paths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const byPath = new Map((signed ?? []).filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]));
  const screenshotUrls = paths.map((p) => byPath.get(p)).filter((u): u is string => Boolean(u));

  const counts = ((activity ?? []) as { team_id: string; message_count: number; doc_count: number; link_count: number }[]).find(
    (a) => a.team_id === project.team_id,
  );

  // Previous and next in this judge's own order; "next" prefers one not yet scored.
  const prev = index > 0 ? projects[index - 1] : null;
  const after = projects.slice(index + 1).concat(projects.slice(0, index));
  const next = after.find((p) => !scores.has(p.id)) ?? (index < projects.length - 1 ? projects[index + 1] : null);

  return (
    <>
      <NoGrid />
      <TopBar sleek title="hackathon" tier={standing.tier} userId={user.id} />
      <SprintAutoRefresh timing={toTiming(sprint)} state={sprint.state} />
      <div className="page-pad" style={{ padding: "16px 26px 48px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 16 }}>
          <Link href={judgeHref(n)} style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
            ← All projects
          </Link>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            Project {index + 1} of {projects.length}
          </span>
        </div>
        <StatusBanner sprint={sprint} />
        <div className="grid stack-md" style={{ gap: 24, gridTemplateColumns: "minmax(0, 1fr) 340px", alignItems: "start" }}>
          <div style={{ minWidth: 0 }}>
            <ProjectShowcase
              fields={fieldsOf(submission)}
              screenshotUrls={screenshotUrls}
              team={project.team}
              members={(people ?? []) as ShowcasePerson[]}
              sprintNumber={n}
            />
          </div>
          <aside style={{ minWidth: 0, position: "sticky", top: 16 }}>
            <ScorePanel
              key={project.id}
              sprint={{ state: sprint.state, phase: sprint.phase, ends_at: sprint.ends_at, judging_ends_at: sprint.judging_ends_at }}
              submissionId={project.id}
              judgeId={user.id}
              initial={scores.get(project.id) ?? null}
              signals={{
                builders: ids.length,
                messages: counts?.message_count ?? 0,
                docs: counts?.doc_count ?? 0,
                links: counts?.link_count ?? 0,
              }}
              prevHref={prev ? judgeHref(n, prev.team.slug) : null}
              nextHref={next && next.id !== project.id ? judgeHref(n, next.team.slug) : null}
              nextScored={next ? scores.has(next.id) : false}
            />
          </aside>
        </div>
      </div>
    </>
  );
}
