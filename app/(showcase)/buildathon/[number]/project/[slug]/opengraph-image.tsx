import { fallbackCard, OG_SIZE, projectCard, publicDb } from "@/lib/hackathons/og";
import { loadPublicProjects, loadPublicSprint } from "@/lib/hackathons/showcase";

// The link preview for a project page (Phase 10). Signed-out data only, and
// the plain Sprints card before the reveal (lib/hackathons/og.tsx).

export const alt = "A project built in 48 hours at a Quorum Buildathon";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ number: string; slug: string }> }) {
  const { number, slug } = await params;
  const n = Number(number);
  const db = publicDb();
  const sprint = Number.isInteger(n) && n > 0 ? await loadPublicSprint(db, n) : null;
  const project = sprint ? (await loadPublicProjects(db, sprint.id)).find((p) => p.team.slug === slug) : undefined;
  return sprint && project ? projectCard(sprint, project) : fallbackCard();
}
