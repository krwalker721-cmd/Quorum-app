"use client";

import { useMemo, useState } from "react";
import ProjectCard from "./ProjectCard";
import { tagCounts, type PublicProject } from "@/lib/hackathons/showcase";
import s from "./showcase.module.css";

const TAGS_SHOWN = 8;

/**
 * Every complete project, with filters: all, award winners, or a "built
 * with" tag (the most used first). Filtering happens here; everything shown
 * is already public.
 */
export default function Gallery({ projects, sprintNumber }: { projects: PublicProject[]; sprintNumber: number }) {
  const [filter, setFilter] = useState<{ kind: "all" } | { kind: "winners" } | { kind: "tag"; tag: string }>({ kind: "all" });
  const [moreTags, setMoreTags] = useState(false);
  const tags = useMemo(() => tagCounts(projects), [projects]);
  const winners = projects.filter((p) => p.awards.length > 0).length;

  const shown = projects.filter((p) =>
    filter.kind === "all" ? true : filter.kind === "winners" ? p.awards.length > 0 : p.fields.built_with.includes(filter.tag),
  );
  // Award winners first, then in the order they were finished.
  const ordered = [...shown].sort((a, b) => Number(b.awards.length > 0) - Number(a.awards.length > 0));

  if (projects.length === 0) return null;

  const chip = (on: boolean, label: string, onClick: () => void, key?: string) => (
    <button key={key ?? label} type="button" className={`${s.filter} ${on ? s.filterOn : ""}`} aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <div>
      <div className={s.filters} role="toolbar" aria-label="Filter projects">
        {chip(filter.kind === "all", `All ${projects.length}`, () => setFilter({ kind: "all" }))}
        {winners > 0 && chip(filter.kind === "winners", `Award winners ${winners}`, () => setFilter({ kind: "winners" }))}
        {(moreTags ? tags : tags.slice(0, TAGS_SHOWN)).map(({ tag, count }) =>
          chip(
            filter.kind === "tag" && filter.tag === tag,
            `${tag} ${count}`,
            () => setFilter(filter.kind === "tag" && filter.tag === tag ? { kind: "all" } : { kind: "tag", tag }),
            `tag-${tag}`,
          ),
        )}
        {tags.length > TAGS_SHOWN && chip(false, moreTags ? "Fewer" : `+${tags.length - TAGS_SHOWN} more`, () => setMoreTags((m) => !m))}
      </div>
      <div className={s.grid}>
        {ordered.map((p) => (
          <ProjectCard key={p.submission_id} project={p} sprintNumber={sprintNumber} />
        ))}
      </div>
    </div>
  );
}
