import Link from "next/link";
import PersonAvatar from "@/components/ui/PersonAvatar";
import { TeamBadge } from "@/components/hackathon/TeamStyle";
import { awardsWithProjects, projectHref, showcasePerson, type PublicProject } from "@/lib/hackathons/showcase";
import { ProjectMedia, awardName } from "./ProjectCard";
import s from "./showcase.module.css";

/**
 * The awards, Judges' pick first: each with its winning project, the team and
 * its builders. Members' names link to their profiles; signed out, it's first
 * names only (the database decides, 032).
 */
export default function AwardsShowcase({ projects, sprintNumber }: { projects: PublicProject[]; sprintNumber: number }) {
  const list = awardsWithProjects(projects);
  if (list.length === 0) return null;
  return (
    <div className={s.awards}>
      {list.map(({ award, project }) => {
        const href = projectHref(sprintNumber, project.team.slug);
        return (
          <article key={award.id} className={s.award}>
            <div className={s.awardHead}>
              <span className={s.awardLabel}>
                <span aria-hidden>★</span>
                {awardName(award)}
              </span>
            </div>
            <Link href={href} className={s.awardMedia} aria-label={`Open ${project.fields.project_name || "the project"}`}>
              <ProjectMedia project={project} />
            </Link>
            <div style={{ padding: "12px 16px 16px" }}>
              <Link href={href} style={{ textDecoration: "none" }}>
                <span style={{ display: "block", fontSize: 18, fontWeight: 650, letterSpacing: "-0.015em", color: "var(--text-primary)" }}>
                  {project.fields.project_name || "Untitled project"}
                </span>
              </Link>
              {project.fields.tagline && (
                <p style={{ fontSize: 13, lineHeight: 1.45, color: "var(--text-secondary)", marginTop: 3 }}>{project.fields.tagline}</p>
              )}
              {award.citation && <p className={s.citation}>“{award.citation}”</p>}
              <div className="flex items-center gap-2" style={{ marginTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
                <TeamBadge name={project.team.name} emblem={project.team.emblem} color={project.team.color} size={20} />
                {project.team.name}
              </div>
              <div className={s.people}>
                {project.members.map((m, i) => {
                  const p = showcasePerson(m, i);
                  return (
                    <span key={p.id} className={s.person}>
                      <PersonAvatar name={p.full_name} stage={p.stage} username={p.username} size={22} />
                      {p.username ? (
                        <Link href={`/profile/${p.username}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {p.full_name}
                        </Link>
                      ) : (
                        p.full_name
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
