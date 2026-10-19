import Link from "next/link";
import { TeamBadge } from "@/components/hackathon/TeamStyle";
import { awardName, projectHref, type PublicProject } from "@/lib/hackathons/showcase";
import s from "./showcase.module.css";

export { awardName };

/** The project's first screenshot, or its team's colour and emblem. */
export function ProjectMedia({ project, className }: { project: PublicProject; className?: string }) {
  const src = project.screenshotUrls[0];
  const c = project.team.color ?? "#f59e0b";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`${project.fields.project_name || "Project"} screenshot`} loading="lazy" className={className} />
  ) : (
    <span className={s.mediaEmpty} style={{ background: `radial-gradient(80% 90% at 30% 20%, ${c}40, ${c}10 60%, #0d1117)`, color: c }} aria-hidden>
      {project.team.emblem || project.team.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * One project in the gallery. With `presentable`, a "Present" button opens it
 * on the page's demo day stage (Theatre, via #present=slug).
 */
export default function ProjectCard({
  project,
  sprintNumber,
  presentable = false,
}: {
  project: PublicProject;
  sprintNumber: number;
  presentable?: boolean;
}) {
  const card = <CardLink project={project} sprintNumber={sprintNumber} />;
  if (!presentable) return card;
  return (
    <div className={s.cardWrap}>
      {card}
      <a href={`#present=${project.team.slug}`} className={s.presentBtn}>
        ▸ Present
      </a>
    </div>
  );
}

function CardLink({ project, sprintNumber }: { project: PublicProject; sprintNumber: number }) {
  const tags = project.fields.built_with;
  return (
    <Link href={projectHref(sprintNumber, project.team.slug)} className={`${s.card} ${project.awards.length ? s.cardWinner : ""}`}>
      <div className={s.media}>
        <ProjectMedia project={project} />
        {project.awards.length > 0 && (
          <div className={s.badges}>
            {project.awards.map((a) => (
              <span key={a.id} className={s.badge}>
                ★ {awardName(a)}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={s.body}>
        <span className={s.name}>{project.fields.project_name || "Untitled project"}</span>
        {project.fields.tagline && <span className={s.tagline}>{project.fields.tagline}</span>}
        {tags.length > 0 && (
          <span className={s.tags}>
            {tags.slice(0, 4).map((t) => (
              <span key={t} className={s.tag}>
                {t}
              </span>
            ))}
            {tags.length > 4 && <span className={s.tag}>+{tags.length - 4}</span>}
          </span>
        )}
        <span className={s.teamLine}>
          <TeamBadge name={project.team.name} emblem={project.team.emblem} color={project.team.color} size={18} />
          {project.team.name}
        </span>
      </div>
    </Link>
  );
}
