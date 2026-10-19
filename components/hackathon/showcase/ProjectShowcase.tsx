import Link from "next/link";
import Markdown from "@/components/Markdown";
import PersonAvatar from "@/components/ui/PersonAvatar";
import ui from "@/components/ui/sleek.module.css";
import { TeamBadge } from "@/components/hackathon/TeamStyle";
import { videoEmbed, type SubmissionFields } from "@/lib/hackathons/submission";

// A project as everyone sees it at the reveal (Phase 8 builds a simple
// version for the submission's preview; Prompt 10's gallery and public page
// reuse it). It only displays what it's given: whoever renders it has
// already decided the viewer may see it, and passes screenshots as URLs
// (signed, since the bucket is private).

export type ShowcaseTeam = { name: string; emblem: string | null; color: string | null };
export type ShowcasePerson = { id: string; full_name: string | null; username: string | null; stage: string | null };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>{title}</h2>
      {children}
    </section>
  );
}

export default function ProjectShowcase({
  fields,
  screenshotUrls,
  team,
  members,
  sprintNumber,
  cohortOf,
  deckUrl,
}: {
  fields: SubmissionFields;
  screenshotUrls: string[];
  team: ShowcaseTeam;
  members: ShowcasePerson[];
  sprintNumber: number;
  /** Members only (Phase 10): each builder's cohort name, by person id. */
  cohortOf?: Record<string, string>;
  /** The team's presentation (035): a short-lived signed link to its PDF. */
  deckUrl?: string | null;
}) {
  const embed = videoEmbed(fields.video_url);
  const links = [
    { label: "Try the demo", href: fields.demo_url, primary: true },
    { label: "Watch the video", href: embed ? "" : fields.video_url, primary: false },
    { label: "See the code", href: fields.repo_url, primary: false },
    { label: "View the presentation", href: deckUrl ?? "", primary: false },
  ].filter((l) => l.href && /^https?:\/\//i.test(l.href));

  return (
    <article style={{ maxWidth: 880, margin: "0 auto" }}>
      <div className="flex items-center gap-2.5" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        <TeamBadge name={team.name} emblem={team.emblem} color={team.color} size={22} />
        <span>
          {team.name} · Buildathon #{sprintNumber}
        </span>
      </div>
      <h1
        className={`${ui.titleGradient} ${ui.balance}`}
        style={{ fontSize: 34, fontWeight: 650, letterSpacing: "-0.03em", lineHeight: 1.1, marginTop: 12 }}
      >
        {fields.project_name || "Untitled project"}
      </h1>
      {fields.tagline && (
        <p className={ui.balance} style={{ fontSize: 17, color: "var(--text-secondary)", marginTop: 10, lineHeight: 1.45 }}>
          {fields.tagline}
        </p>
      )}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2.5" style={{ marginTop: 18 }}>
          {links.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer nofollow" className={l.primary ? ui.primaryBtn : ui.softBtn}>
              {l.label} ↗
            </a>
          ))}
        </div>
      )}

      {embed ? (
        <div style={{ marginTop: 22, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", aspectRatio: "16 / 9", background: "#000" }}>
          <iframe
            src={embed}
            title={`${fields.project_name || "Project"} video`}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ width: "100%", height: "100%", border: 0 }}
          />
        </div>
      ) : screenshotUrls[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={screenshotUrls[0]}
          alt={`${fields.project_name || "Project"} screenshot`}
          style={{ marginTop: 22, width: "100%", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", display: "block" }}
        />
      ) : null}

      {fields.problem && (
        <Section title="The problem">
          <p className="whitespace-pre-wrap" style={{ fontSize: 15, lineHeight: 1.65, color: "var(--text-primary)" }}>
            {fields.problem}
          </p>
        </Section>
      )}

      {fields.description && (
        <Section title="What they built">
          <div style={{ fontSize: 14.5 }}>
            <Markdown source={fields.description} plainHeadings />
          </div>
        </Section>
      )}

      {screenshotUrls.length > (embed ? 0 : 1) && (
        <Section title="Screenshots">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {screenshotUrls.slice(embed ? 0 : 1).map((src, i) => (
              <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Screenshot ${i + (embed ? 1 : 2)}`}
                  loading="lazy"
                  style={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", display: "block" }}
                />
              </a>
            ))}
          </div>
        </Section>
      )}

      {fields.built_with.length > 0 && (
        <Section title="Built with">
          <div className="flex flex-wrap gap-2">
            {fields.built_with.map((t) => (
              <span key={t} className={ui.chip}>
                {t}
              </span>
            ))}
          </div>
        </Section>
      )}

      {members.length > 0 && (
        <Section title="The team">
          <div className="flex flex-wrap gap-4">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <PersonAvatar name={m.full_name} stage={m.stage} username={m.username} size={28} />
                {m.username ? (
                  <Link href={`/profile/${m.username}`} style={{ fontSize: 13, color: "var(--text-primary)", textDecoration: "none" }}>
                    {m.full_name ?? m.username}
                  </Link>
                ) : (
                  <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{m.full_name ?? "Founder"}</span>
                )}
                {cohortOf?.[m.id] && <span className={ui.chip}>{cohortOf[m.id]}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </article>
  );
}
