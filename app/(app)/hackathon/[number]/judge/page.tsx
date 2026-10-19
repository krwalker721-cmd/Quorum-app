import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import NoGrid from "@/components/ui/NoGrid";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";
import SprintAutoRefresh from "@/components/hackathon/SprintAutoRefresh";
import { StatusBanner } from "@/components/hackathon/SprintSections";
import { TeamBadge } from "@/components/hackathon/TeamStyle";
import ScoringStatus from "@/components/hackathon/judging/ScoringStatus";
import RubricTile from "@/components/hackathon/judging/RubricTile";
import { loadSprint } from "@/lib/hackathons/page";
import { getMemberStanding } from "@/lib/hackathons/viewer";
import { toTiming } from "@/lib/hackathons/sprint";
import { judgeHref, judgeStatus, loadJudgeQueue, overall } from "@/lib/hackathons/judging";

export const dynamic = "force-dynamic";

// The judge's list (Phase 9): every complete submission, in this judge's own
// order, with what they've scored. Accepted judges only. Nothing here needs a
// paid membership: judges don't pay (decision 13). What a judge can read is
// RLS's call (020, 030): complete submissions, from the deadline.
export default async function JudgePage(props: { params: Promise<{ number: string }> }) {
  const { number } = await props.params;
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

  const opened = sprint.phase === "judging" || sprint.phase === "revealed";
  const { projects, scores } = opened ? await loadJudgeQueue(supabase, sprint.id, user.id) : { projects: [], scores: new Map() };
  const scored = projects.filter((p) => scores.has(p.id)).length;
  const next = projects.find((p) => !scores.has(p.id));

  return (
    <>
      <NoGrid />
      <TopBar sleek title="buildathon" tier={standing.tier} userId={user.id} />
      <SprintAutoRefresh timing={toTiming(sprint)} state={sprint.state} />
      <div className="page-pad" style={{ padding: "16px 26px 48px", maxWidth: 1080, margin: "0 auto", width: "100%" }}>
        <Link href={`/hackathon/${n}`} style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
          ← Buildathon #{n}
        </Link>
        <h1
          className={`${ui.titleGradient} ${ui.balance}`}
          style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15, marginTop: 12 }}
        >
          Judging
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 16 }}>
          Score each project on four things, 1 to 5. Your scores and notes are private: only you and the admins see them,
          and nobody sees a ranking. The admins choose the awards from everyone&apos;s scores.
        </p>
        <StatusBanner sprint={sprint} />

        <Tile gradient style={{ marginBottom: 16 }} padding="16px 18px">
          <ScoringStatus
            sprint={{ state: sprint.state, phase: sprint.phase, ends_at: sprint.ends_at, judging_ends_at: sprint.judging_ends_at, reveal_at: sprint.reveal_at, show_countdown_in_app: sprint.show_countdown_in_app }}
            scored={scored}
            total={projects.length}
            nextHref={next ? judgeHref(n, next.team.slug) : null}
          />
        </Tile>

        <div className="grid stack-md" style={{ gap: 16, gridTemplateColumns: "minmax(0, 1fr) 320px", alignItems: "start" }}>
          <div style={{ minWidth: 0 }}>
            <Tile kicker="Projects" right={opened ? `${scored} of ${projects.length} scored` : undefined}>
              {!opened ? (
                <div className={ui.empty}>
                  <p className={ui.emptyTitle}>Projects appear here when submissions close.</p>
                  <p className={ui.emptySub}>They&apos;re sealed until then, from judges too.</p>
                </div>
              ) : projects.length === 0 ? (
                <div className={ui.empty}>
                  <p className={ui.emptyTitle}>No team finished a submission.</p>
                  <p className={ui.emptySub}>Only complete submissions are judged; drafts stay with their teams.</p>
                </div>
              ) : (
                <ul className="flex flex-col" style={{ gap: 8 }}>
                  {projects.map((p) => {
                    const s = scores.get(p.id);
                    return (
                      <li key={p.id}>
                        <Link
                          href={judgeHref(n, p.team.slug)}
                          className="flex items-center gap-3"
                          style={{
                            padding: "11px 12px",
                            borderRadius: 10,
                            border: `1px solid ${s ? "rgba(255, 255, 255, 0.07)" : "rgba(245, 158, 11, 0.28)"}`,
                            background: "rgba(0, 0, 0, 0.15)",
                            textDecoration: "none",
                          }}
                        >
                          <TeamBadge name={p.team.name} emblem={p.team.emblem} color={p.team.color} size={30} />
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--text-primary)" }}>
                              {p.project_name ?? "Untitled project"}
                            </span>
                            {p.tagline && (
                              <span
                                style={{ display: "block", fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                              >
                                {p.tagline}
                              </span>
                            )}
                            <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>by {p.team.name}</span>
                          </span>
                          {s ? (
                            <span style={{ fontSize: 12, color: "#4ade80", whiteSpace: "nowrap" }}>
                              Scored ✓ <span style={{ color: "var(--text-muted)" }}>{overall(s).toFixed(1)}</span>
                            </span>
                          ) : (
                            <span className={`${ui.chip} ${ui.chipAmber}`} style={{ whiteSpace: "nowrap" }}>
                              Not scored
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Tile>
          </div>
          <aside style={{ minWidth: 0 }}>
            <RubricTile />
          </aside>
        </div>
      </div>
    </>
  );
}
