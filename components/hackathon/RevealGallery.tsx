import Link from "next/link";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";
import RevealMoment, { type StageTeam } from "@/components/hackathon/showcase/RevealMoment";
import AwardsShowcase from "@/components/hackathon/showcase/AwardsShowcase";
import Gallery from "@/components/hackathon/showcase/Gallery";
import { awardsWithProjects, recapHref, type PublicProject } from "@/lib/hackathons/showcase";
import type { ArenaTeam } from "@/lib/hackathons/page";

// After the reveal, on the members' Sprint page (Phase 10): the reveal moment
// for whoever was watching, then the awards and the gallery. Teams that
// didn't finish a project are named gently at the end, here only; the public
// recap leaves them out (owner, Phase 10). A team with an unfinished draft
// reads the same as one that never started: drafts stay sealed for good.

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export default function RevealedShowcase({
  sprintNumber,
  revealAt,
  teams,
  projects,
}: {
  sprintNumber: number;
  revealAt: string;
  teams: ArenaTeam[];
  projects: PublicProject[];
}) {
  const byTeam = new Map(projects.map((p) => [p.team_id, p]));
  const stage: StageTeam[] = teams.map((t) => {
    const p = byTeam.get(t.id);
    return {
      id: t.id,
      name: t.name,
      emblem: t.emblem,
      color: t.color,
      project: p ? { name: p.fields.project_name || "Untitled project", image: p.screenshotUrls[0] ?? null } : null,
    };
  });
  const quiet = teams.filter((t) => !byTeam.has(t.id)).map((t) => t.name);
  const hasAwards = awardsWithProjects(projects).length > 0;

  return (
    <RevealMoment sprintNumber={sprintNumber} revealAt={revealAt} teams={stage}>
      {hasAwards && (
        <Tile kicker="Awards" gradient style={{ marginBottom: 16 }} padding="16px 16px 18px">
          <AwardsShowcase projects={projects} sprintNumber={sprintNumber} />
        </Tile>
      )}
      <Tile
        kicker="Everything that shipped"
        right={
          <Link href={recapHref(sprintNumber)} style={{ fontSize: 12.5, color: "#f8c56a", textDecoration: "none" }}>
            Public recap ↗
          </Link>
        }
        style={{ marginBottom: 16 }}
      >
        {projects.length === 0 ? (
          <div className={ui.empty}>
            <p className={ui.emptyTitle}>No project was finished in this Buildathon.</p>
          </div>
        ) : (
          <Gallery projects={projects} sprintNumber={sprintNumber} />
        )}
        {quiet.length > 0 && projects.length > 0 && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 16, lineHeight: 1.55 }}>
            Also in the Buildathon: {joinNames(quiet)}, who shipped learnings, not a project.
          </p>
        )}
      </Tile>
    </RevealMoment>
  );
}

/**
 * The finished Sprint, for members (2026-10-18): the recap around the Sprint
 * chat. The reveal moment still plays for whoever was watching; then the
 * numbers, the awards, the stage (demo day beside the chat), every project,
 * how it went, and the final arena.
 */
export function RevealedRecap({
  sprintNumber,
  revealAt,
  teams,
  projects,
  stats,
  stage,
  timeline,
  arena,
  met = null,
}: {
  sprintNumber: number;
  revealAt: string;
  teams: ArenaTeam[];
  projects: PublicProject[];
  stats: { value: number; label: string }[];
  /** The demo day stage with the chat beside it (LiveStage). */
  stage: React.ReactNode;
  timeline: React.ReactNode;
  arena: React.ReactNode;
  /** For someone who took part: the people they built with and reviewed. */
  met?: React.ReactNode;
}) {
  const byTeam = new Map(projects.map((p) => [p.team_id, p]));
  const stageTeams: StageTeam[] = teams.map((t) => {
    const p = byTeam.get(t.id);
    return {
      id: t.id,
      name: t.name,
      emblem: t.emblem,
      color: t.color,
      project: p ? { name: p.fields.project_name || "Untitled project", image: p.screenshotUrls[0] ?? null } : null,
    };
  });
  const quiet = teams.filter((t) => !byTeam.has(t.id)).map((t) => t.name);
  const hasAwards = awardsWithProjects(projects).length > 0;

  return (
    <RevealMoment sprintNumber={sprintNumber} revealAt={revealAt} teams={stageTeams}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`, gap: 10, marginBottom: 16 }}>
        {stats.map((st) => (
          <div key={st.label} style={{ border: "1px solid rgba(255, 255, 255, 0.07)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 24, fontWeight: 650, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
              {st.value}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 4 }}>{st.label}</div>
          </div>
        ))}
      </div>

      {hasAwards && (
        <Tile kicker="Awards" gradient style={{ marginBottom: 20 }} padding="16px 16px 18px">
          <AwardsShowcase projects={projects} sprintNumber={sprintNumber} />
        </Tile>
      )}

      {stage}

      <section aria-label="Every project" style={{ marginBottom: 24 }}>
        <div className="flex items-baseline justify-between gap-3" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Everything that shipped</h2>
          <Link href={recapHref(sprintNumber)} style={{ fontSize: 12.5, color: "#f8c56a", textDecoration: "none" }}>
            Public recap ↗
          </Link>
        </div>
        {projects.length === 0 ? (
          <div className={ui.empty}>
            <p className={ui.emptyTitle}>No project was finished in this Buildathon.</p>
          </div>
        ) : (
          <Gallery projects={projects} sprintNumber={sprintNumber} presentable />
        )}
        {quiet.length > 0 && projects.length > 0 && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 16, lineHeight: 1.55 }}>
            Also in the Buildathon: {joinNames(quiet)}, who shipped learnings, not a project.
          </p>
        )}
      </section>

      {met}
      {timeline}
      {arena}
    </RevealMoment>
  );
}
