import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublicShell, { SprintCta } from "@/components/hackathon/showcase/PublicShell";
import AwardsShowcase from "@/components/hackathon/showcase/AwardsShowcase";
import Theatre from "@/components/hackathon/showcase/Theatre";
import { runReviewsIfDue } from "@/lib/hackathons/reviews";
import SprintTimeline from "@/components/hackathon/showcase/SprintTimeline";
import Gallery from "@/components/hackathon/showcase/Gallery";
import ShareButtons from "@/components/hackathon/showcase/ShareButtons";
import LocalTime from "@/components/hackathon/LocalTime";
import ui from "@/components/ui/sleek.module.css";
import s from "@/components/hackathon/showcase/showcase.module.css";
import { LEGAL } from "@/lib/legal";
import { awardsWithProjects, loadPublicProjects, loadPublicSprint, recapHref } from "@/lib/hackathons/showcase";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ number: string }> };

// A Sprint's recap, public after the reveal (Phase 10): the headline numbers,
// the awards and every project, laid out to be screenshotted. Teams that
// didn't finish a project aren't mentioned here (owner, Phase 10); the
// members' Sprint page names them gently. 404 before the reveal (032).

const loadRecap = cache(async (number: string) => {
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) return null;
  const db = await createClient();
  const sprint = await loadPublicSprint(db, n);
  if (!sprint) return null;
  // The awards are worked out at the reveal by whichever page loads first (036).
  await runReviewsIfDue(sprint.id);
  return { sprint, projects: await loadPublicProjects(db, sprint.id, { every: true }) };
});

export async function generateMetadata(props: Props): Promise<Metadata> {
  const data = await loadRecap((await props.params).number);
  if (!data) return { title: "Not found", robots: { index: false } };
  const { sprint } = data;
  const title = `Quorum Sprint #${sprint.number}: ${sprint.title}`;
  const description = `${sprint.shipped} ${sprint.shipped === 1 ? "project" : "projects"} built in 48 hours by ${sprint.builders} founders on ${sprint.teams} teams.`;
  const url = `${LEGAL.site}${recapHref(sprint.number)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", title, description, url, siteName: "Quorum" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RecapPage(props: Props) {
  const data = await loadRecap((await props.params).number);
  if (!data) notFound();
  const { sprint, projects } = data;

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  const stats = [
    { value: sprint.teams, label: sprint.teams === 1 ? "team" : "teams" },
    { value: sprint.builders, label: sprint.builders === 1 ? "builder" : "builders" },
    { value: sprint.cohorts, label: sprint.cohorts === 1 ? "cohort represented" : "cohorts represented" },
    { value: sprint.shipped, label: sprint.shipped === 1 ? "project shipped" : "projects shipped" },
  ].filter((st) => st.value > 0 || !st.label.startsWith("cohort"));
  const hasAwards = awardsWithProjects(projects).length > 0;

  return (
    <PublicShell signedIn={Boolean(user)} back={{ href: `/hackathon/${sprint.number}`, label: `← Sprint #${sprint.number}` }}>
      <header style={{ textAlign: "center", maxWidth: 760, margin: "0 auto" }}>
        <p style={{ fontSize: 13, color: "#f8c56a", fontWeight: 600 }}>Quorum Sprint #{sprint.number} · the recap</p>
        <h1
          className={`${ui.titleGradient} ${ui.balance}`}
          style={{ fontSize: "clamp(34px, 6vw, 56px)", fontWeight: 650, letterSpacing: "-0.035em", lineHeight: 1.04, marginTop: 10 }}
        >
          {sprint.title}
        </h1>
        {sprint.tagline && (
          <p className={ui.balance} style={{ fontSize: 17, color: "var(--text-secondary)", marginTop: 12, lineHeight: 1.5 }}>
            {sprint.tagline}
          </p>
        )}
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}>
          48 hours, from <LocalTime iso={sprint.starts_at} format="date" />
          {sprint.theme && <> · Theme: <span style={{ color: "var(--text-primary)" }}>{sprint.theme}</span></>}
        </p>
      </header>

      <div
        className={`${s.stats} ${stats.length === 4 ? s.stats4 : ""}`}
        style={{ marginTop: 28, ["--stats" as string]: stats.length } as React.CSSProperties}
      >
        {stats.map((st) => (
          <div key={st.label} className={s.stat}>
            <div className={s.statValue}>{st.value}</div>
            <div className={s.statLabel}>{st.label}</div>
          </div>
        ))}
      </div>

      {hasAwards && (
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 650, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 14 }}>Awards</h2>
          <AwardsShowcase projects={projects} sprintNumber={sprint.number} />
        </section>
      )}

      {projects.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 650, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 14 }}>
            Demo day
          </h2>
          <Theatre projects={projects} sprintNumber={sprint.number} />
        </section>
      )}

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 650, letterSpacing: "-0.02em", color: "var(--text-primary)", marginBottom: 14 }}>
          Everything that shipped
        </h2>
        {projects.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>The projects from this Sprint will appear here.</p>
        ) : (
          <Gallery projects={projects} sprintNumber={sprint.number} presentable />
        )}
      </section>

      <div style={{ marginTop: 40 }}>
        <SprintTimeline startsAt={sprint.starts_at} endsAt={sprint.ends_at} revealAt={sprint.reveal_at} projects={projects} teamCount={sprint.teams} />
      </div>

      <section style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>Share this recap</p>
        <ShareButtons
          url={`${LEGAL.site}${recapHref(sprint.number)}`}
          text={`${sprint.shipped} projects built in 48 hours at Quorum Sprint #${sprint.number}`}
        />
      </section>

      {!user && <SprintCta />}
    </PublicShell>
  );
}
