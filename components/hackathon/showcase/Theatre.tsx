"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TeamBadge } from "@/components/hackathon/TeamStyle";
import { videoEmbed } from "@/lib/hackathons/submission";
import { awardName, projectHref, type PublicProject } from "@/lib/hackathons/showcase";
import s from "./theatre.module.css";

// Demo day (the finished Sprint, 2026-10-18): one stage, one team at a time.
// A team's deck (035) plays in the browser's own PDF viewer; a team without
// one presents what it has instead: its video, its screenshots, or its demo.
// ‹ › and the arrow keys walk through every team; the strip jumps anywhere.
// Elsewhere on the page, "Present" buttons open a team here (#present=slug).
//
// Award winners first, then the order the projects were finished. Some phone
// browsers (Android) can't draw a PDF inside a page, so "Open the deck" is
// always offered under it.

export default function Theatre({
  projects,
  sprintNumber,
  fill = false,
}: {
  projects: PublicProject[];
  sprintNumber: number;
  /** Fill its container's height (the stage beside the chat). */
  fill?: boolean;
}) {
  const ordered = useMemo(
    () => [...projects].sort((a, b) => Number(b.awards.length > 0) - Number(a.awards.length > 0)),
    [projects],
  );
  const [index, setIndex] = useState(0);
  const root = useRef<HTMLElement>(null);

  const go = useCallback(
    (i: number) => {
      if (ordered.length === 0) return;
      setIndex(((i % ordered.length) + ordered.length) % ordered.length);
    },
    [ordered.length],
  );

  // "Present" elsewhere on the page: #present=<team slug>.
  useEffect(() => {
    const fromHash = () => {
      const m = /present=([a-z0-9-]+)/.exec(window.location.hash);
      if (!m) return;
      const i = ordered.findIndex((p) => p.team.slug === m[1]);
      if (i === -1) return;
      go(i);
      // Clear it, so pressing the same team's Present again still works.
      history.replaceState(null, "", window.location.pathname + window.location.search);
      root.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      root.current?.focus({ preventScroll: true });
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [ordered, go]);

  if (ordered.length === 0) {
    return (
      <section ref={root} className={`${s.theatre} ${fill ? s.fill : ""}`} aria-label="Demo day">
        <div className={s.empty}>No project was finished in this Sprint, so there&rsquo;s nothing to present.</div>
      </section>
    );
  }

  const p = ordered[index];
  const embed = videoEmbed(p.fields.video_url);
  const shots = p.screenshotUrls;
  const demo = /^https?:\/\//i.test(p.fields.demo_url) ? p.fields.demo_url : null;

  return (
    <section
      ref={root}
      className={`${s.theatre} ${fill ? s.fill : ""}`}
      aria-label="Demo day"
      tabIndex={-1}
      style={{ scrollMarginTop: 80 }}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div className={s.bar}>
        <span className={s.barTitle}>Demo day</span>
        <span className={s.count}>
          {index + 1} of {ordered.length}
        </span>
        <span className={s.nav}>
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous team">
            ‹
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next team">
            ›
          </button>
        </span>
      </div>

      <ProjectScreen key={p.submission_id} project={p} />

      <div className={s.info}>
        <div className={s.infoMain}>
          <div className="flex items-center gap-2 flex-wrap">
            <TeamBadge name={p.team.name} emblem={p.team.emblem} color={p.team.color} size={20} />
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{p.team.name}</span>
            {p.awards.map((a) => (
              <span key={a.id} className={s.award}>
                ★ {awardName(a)}
              </span>
            ))}
          </div>
          <p className={s.name}>{p.fields.project_name || "Untitled project"}</p>
          {p.fields.tagline && <p className={s.tagline}>{p.fields.tagline}</p>}
        </div>
        <div className={s.links}>
          {p.deckUrl && (
            <a href={p.deckUrl} target="_blank" rel="noopener noreferrer" className={s.link}>
              Open the deck ↗
            </a>
          )}
          {demo && (p.deckUrl || embed || shots.length > 0) && (
            <a href={demo} target="_blank" rel="noopener noreferrer nofollow" className={s.link}>
              Demo ↗
            </a>
          )}
          <Link href={projectHref(sprintNumber, p.team.slug)} className={s.link}>
            Project page →
          </Link>
        </div>
      </div>

      <div className={s.strip} role="tablist" aria-label="Teams">
        {ordered.map((q, i) => (
          <button
            key={q.submission_id}
            type="button"
            role="tab"
            aria-selected={i === index}
            className={`${s.chip} ${i === index ? s.chipOn : ""}`}
            style={{ ["--team" as string]: q.team.color ?? "#f59e0b" }}
            onClick={() => go(i)}
            title={q.fields.project_name || q.team.name}
          >
            <span className={s.chipEmblem}>{q.team.emblem || q.team.name.slice(0, 1).toUpperCase()}</span>
            <span className={s.chipName}>{q.fields.project_name || q.team.name}</span>
            {q.deckUrl && <span className={s.chipDeck}>deck</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * What a team shows on a stage: its deck in the browser's PDF viewer, or its
 * video, its screenshots, or a placeholder with its demo. Used by demo day
 * and by the peer reviews (036).
 */
export function ProjectScreen({ project: p, className }: { project: PublicProject; className?: string }) {
  const [shot, setShot] = useState(0);
  const embed = videoEmbed(p.fields.video_url);
  const shots = p.screenshotUrls;
  const demo = /^https?:\/\//i.test(p.fields.demo_url) ? p.fields.demo_url : null;
  return (
    <div className={`${s.screen} ${className ?? ""}`}>
      {p.deckUrl ? (
        <iframe src={`${p.deckUrl}#view=FitH&toolbar=0`} title={`${p.fields.project_name || "Project"} presentation`} className={s.frame} />
      ) : embed ? (
        <iframe
          src={embed}
          title={`${p.fields.project_name || "Project"} video`}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className={s.frame}
        />
      ) : shots.length > 0 ? (
        <div className={s.shots}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shots[Math.min(shot, shots.length - 1)]} alt={`${p.fields.project_name || "Project"} screenshot ${shot + 1}`} className={s.shot} />
          {shots.length > 1 && (
            <div className={s.thumbs}>
              {shots.map((u, i) => (
                <button key={u} type="button" className={`${s.thumb} ${i === shot ? s.thumbOn : ""}`} onClick={() => setShot(i)} aria-label={`Screenshot ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={s.placeholder} style={{ ["--team" as string]: p.team.color ?? "#f59e0b" }}>
          <span className={s.placeholderEmblem}>{p.team.emblem || p.team.name.slice(0, 1).toUpperCase()}</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>No slides or screenshots for this one.</span>
          {demo && (
            <a href={demo} target="_blank" rel="noopener noreferrer nofollow" className={s.demoBtn}>
              Try the demo ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
