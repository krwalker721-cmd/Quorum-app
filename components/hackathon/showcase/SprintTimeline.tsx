import LocalTime from "@/components/hackathon/LocalTime";
import type { PublicProject } from "@/lib/hackathons/showcase";

// How it went (the finished Sprint, 2026-10-18): the 48 hours from kickoff to
// the deadline as one track, each team's submission a mark where it landed,
// then the facts worth telling: first in, last in, how many shipped.

const HOUR = 3_600_000;

function span(ms: number) {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return `${h} h`;
}

export default function SprintTimeline({
  startsAt,
  endsAt,
  revealAt,
  projects,
  teamCount,
}: {
  startsAt: string | null;
  endsAt: string | null;
  revealAt: string | null;
  projects: PublicProject[];
  teamCount: number;
}) {
  if (!startsAt || !endsAt) return null;
  const t0 = Date.parse(startsAt);
  const t1 = Date.parse(endsAt);
  const total = Math.max(HOUR, t1 - t0);
  const marks = projects
    .filter((p) => p.completed_at)
    .map((p) => ({ p, at: Date.parse(p.completed_at!) }))
    .sort((a, b) => a.at - b.at);
  const first = marks[0];
  const last = marks[marks.length - 1];
  const pct = (at: number) => Math.min(100, Math.max(0, ((at - t0) / total) * 100));

  const facts: { label: string; value: string }[] = [
    { label: "Shipped", value: `${projects.length} of ${teamCount} team${teamCount === 1 ? "" : "s"}` },
    ...(first ? [{ label: "First in", value: `${first.p.fields.project_name || first.p.team.name}, ${t1 - first.at > 0 ? `${span(t1 - first.at)} before the deadline` : "at the deadline"}` }] : []),
    ...(last && last !== first ? [{ label: "Last in", value: `${last.p.fields.project_name || last.p.team.name}, with ${span(Math.max(0, t1 - last.at))} to spare` }] : []),
  ];

  return (
    <section aria-label="How it went" style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>How it went</h2>
      <div style={{ border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 14, padding: "18px 18px 14px" }}>
        {/* The track: kickoff to deadline, with every submission on it. */}
        <div style={{ position: "relative", height: 46, margin: "0 12px" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 22, height: 2, borderRadius: 2, background: "linear-gradient(90deg, rgba(245, 158, 11, 0.25), rgba(245, 158, 11, 0.7))" }} />
          {[0, 50, 100].map((x) => (
            <span key={x} aria-hidden style={{ position: "absolute", left: `${x}%`, top: 16, width: 1, height: 14, background: "rgba(255, 255, 255, 0.25)", transform: "translateX(-50%)" }} />
          ))}
          {marks.map(({ p, at }) => (
            <span
              key={p.submission_id}
              title={`${p.fields.project_name || p.team.name} · submitted`}
              style={{
                position: "absolute",
                left: `${pct(at)}%`,
                top: 10,
                transform: "translateX(-50%)",
                width: 26,
                height: 26,
                borderRadius: 8,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: p.team.color ?? "#f59e0b",
                background: "var(--bg-surface)",
                border: `1px solid ${p.team.color ?? "#f59e0b"}88`,
                boxShadow: "0 0 0 3px var(--bg-surface)",
              }}
            >
              {p.team.emblem || p.team.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
        <div className="flex justify-between" style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
          <span>
            Kickoff · <LocalTime iso={startsAt} />
          </span>
          <span className="hidden sm:inline">Halfway</span>
          <span>
            Deadline · <LocalTime iso={endsAt} />
          </span>
        </div>

        <dl className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 16 }}>
          {facts.map((f) => (
            <div key={f.label} style={{ border: "1px solid rgba(255, 255, 255, 0.07)", borderRadius: 10, padding: "9px 12px" }}>
              <dt style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{f.label}</dt>
              <dd style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>{f.value}</dd>
            </div>
          ))}
          {revealAt && (
            <div style={{ border: "1px solid rgba(255, 255, 255, 0.07)", borderRadius: 10, padding: "9px 12px" }}>
              <dt style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Revealed</dt>
              <dd style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2 }}>
                <LocalTime iso={revealAt} />
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}
