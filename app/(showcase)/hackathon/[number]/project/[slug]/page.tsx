import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PublicShell, { SprintCta } from "@/components/hackathon/showcase/PublicShell";
import ProjectShowcase from "@/components/hackathon/showcase/ProjectShowcase";
import ShareButtons from "@/components/hackathon/showcase/ShareButtons";
import ProjectCard, { awardName } from "@/components/hackathon/showcase/ProjectCard";
import s from "@/components/hackathon/showcase/showcase.module.css";
import { LEGAL } from "@/lib/legal";
import {
  loadPublicProjects,
  loadPublicSprint,
  projectHref,
  recapHref,
  showcasePerson,
  type PublicProject,
  type PublicSprint,
} from "@/lib/hackathons/showcase";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ number: string; slug: string }> };

// One project, public after the reveal (Phase 10): this is the page that gets
// shared. Signed out it's the project, the team's first names and Quorum's
// call to action; members also get profile links and cohort names. Before the
// reveal there's nothing here at all: migration 032's functions return no
// rows, so this is a 404 for everyone.

// Once per request, shared by the metadata and the page.
const loadProject = cache(
  async (number: string, slug: string): Promise<{ sprint: PublicSprint; project: PublicProject; projects: PublicProject[] } | null> => {
    const n = Number(number);
    if (!Number.isInteger(n) || n < 1) return null;
    const db = await createClient();
    const sprint = await loadPublicSprint(db, n);
    if (!sprint) return null;
    const projects = await loadPublicProjects(db, sprint.id, { allFor: slug });
    const project = projects.find((p) => p.team.slug === slug);
    return project ? { sprint, project, projects } : null;
  },
);

async function load(props: Props) {
  const { number, slug } = await props.params;
  return loadProject(number, slug);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const data = await load(props);
  if (!data) return { title: "Not found", robots: { index: false } };
  const { sprint, project } = data;
  const name = project.fields.project_name || "A project";
  const award = project.awards[0];
  const title = `${name} · Quorum Sprint #${sprint.number}`;
  const description =
    (award ? `${awardName(award)}. ` : "") +
    (project.fields.tagline || `Built in 48 hours by team ${project.team.name} at Quorum Sprint #${sprint.number}.`);
  const url = `${LEGAL.site}${projectHref(sprint.number, project.team.slug)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", title, description, url, siteName: "Quorum" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicProjectPage(props: Props) {
  const data = await load(props);
  if (!data) notFound();
  const { sprint, project, projects } = data;

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  // Cohort names are for members (027's audience); signed out this is empty.
  const { data: cohortRows } = user ? await db.rpc("hackathon_arena_cohorts", { p_hackathon_id: sprint.id }) : { data: null };
  const cohortOf = Object.fromEntries(((cohortRows ?? []) as { user_id: string; cohort_name: string }[]).map((r) => [r.user_id, r.cohort_name]));

  const url = `${LEGAL.site}${projectHref(sprint.number, project.team.slug)}`;
  const name = project.fields.project_name || "this project";
  const others = projects.filter((p) => p.submission_id !== project.submission_id).slice(0, 3);

  return (
    <PublicShell signedIn={Boolean(user)} back={{ href: `/hackathon/${sprint.number}`, label: `← Sprint #${sprint.number}` }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link href={recapHref(sprint.number)} style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
          Quorum Sprint #{sprint.number} · {sprint.title} · built in 48 hours
        </Link>

        {project.awards.length > 0 && (
          <div className="flex flex-col" style={{ gap: 8, marginTop: 16 }}>
            {project.awards.map((a) => (
              <div key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className={s.badge}>★ {awardName(a)}</span>
                {a.citation && <span className={s.citation} style={{ marginTop: 0 }}>“{a.citation}”</span>}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 22 }}>
          <ProjectShowcase
            fields={project.fields}
            screenshotUrls={project.screenshotUrls}
            team={project.team}
            members={project.members.map(showcasePerson)}
            sprintNumber={sprint.number}
            cohortOf={cohortOf}
            deckUrl={project.deckUrl}
          />
        </div>

        <section style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>Share {name}</p>
          <ShareButtons
            url={url}
            text={`${name}, built in 48 hours by ${project.team.name} at Quorum Sprint #${sprint.number}`}
          />
        </section>

        {others.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <div className="flex items-baseline justify-between gap-3" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>More from Sprint #{sprint.number}</h2>
              <Link href={recapHref(sprint.number)} style={{ fontSize: 12.5, color: "#f8c56a", textDecoration: "none" }}>
                See every project →
              </Link>
            </div>
            <div className={s.grid}>
              {others.map((p) => (
                <ProjectCard key={p.submission_id} project={p} sprintNumber={sprint.number} />
              ))}
            </div>
          </section>
        )}

        {!user && <SprintCta />}
      </div>
    </PublicShell>
  );
}
