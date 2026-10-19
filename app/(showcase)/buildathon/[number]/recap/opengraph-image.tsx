import { fallbackCard, OG_SIZE, publicDb, recapCard } from "@/lib/hackathons/og";
import { awardName, awardsWithProjects, loadPublicProjects, loadPublicSprint } from "@/lib/hackathons/showcase";

// The link preview for a Sprint's recap (Phase 10). Signed-out data only, and
// the plain Sprints card before the reveal (lib/hackathons/og.tsx).

export const alt = "A Quorum Buildathon recap: what founders built in 48 hours";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ number: string }> }) {
  const n = Number((await params).number);
  const db = publicDb();
  const sprint = Number.isInteger(n) && n > 0 ? await loadPublicSprint(db, n) : null;
  if (!sprint) return fallbackCard();
  const winners = awardsWithProjects(await loadPublicProjects(db, sprint.id)).map(({ award, project }) => ({
    award: awardName(award),
    project: project.fields.project_name || project.team.name,
  }));
  return recapCard(sprint, winners);
}
