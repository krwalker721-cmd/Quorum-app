import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { awardName, type PublicProject, type PublicSprint } from "@/lib/hackathons/showcase";

// Link previews for the public showcase pages (Phase 10), in the site card's
// style (app/opengraph-image.tsx): dark, an amber glow, the Quorum mark.
// Satori lays these out: every element with more than one child needs
// display: flex, and there's no background-clip text. Screenshots are WebP,
// which Satori can't draw, so the cards are type only; team emblems are drawn
// as the team's initial in its colour (the emblem glyphs aren't in the font).
//
// Data comes from a signed-out client: a preview is exactly what the public
// may see, and before the reveal the database gives nothing (032), so the
// card falls back to the generic one.

export const OG_SIZE = { width: 1200, height: 630 };
const AMBER = "#f59e0b";
const BG = {
  background: "#0b0e13",
  backgroundImage:
    "radial-gradient(circle at 18% 0%, rgba(245,158,11,0.26), rgba(245,158,11,0) 55%), radial-gradient(circle at 92% 100%, rgba(248,197,106,0.12), rgba(248,197,106,0) 50%)",
};

const NODES: [number, number][] = [
  [14, 2],
  [23, 7],
  [23, 21],
  [14, 26],
  [5, 21],
  [5, 7],
];

function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28">
      {NODES.map(([x, y], i) => {
        const [nx, ny] = NODES[(i + 1) % NODES.length];
        return (
          <g key={i}>
            <line x1={x} y1={y} x2={nx} y2={ny} stroke={AMBER} strokeWidth="0.8" opacity="0.5" />
            <line x1="14" y1="14" x2={x} y2={y} stroke={AMBER} strokeWidth="0.5" opacity="0.25" />
            <circle cx={x} cy={y} r="2.4" fill={AMBER} />
          </g>
        );
      })}
      <circle cx="14" cy="14" r="1.8" fill={AMBER} opacity="0.7" />
    </svg>
  );
}

function Star({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.5l7.1-.6z" fill={color} />
    </svg>
  );
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** A signed-out client: previews show only what the public may see. */
export function publicDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function Frame({ right, children, footer }: { right: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "60px 72px",
        color: "#e6edf3",
        ...BG,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Mark size={46} />
          <span style={{ fontSize: 30, letterSpacing: "0.02em" }}>quorum</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#f8c56a",
            padding: "8px 18px",
            borderRadius: 999,
            border: "1px solid rgba(245,158,11,0.45)",
            background: "rgba(245,158,11,0.1)",
          }}
        >
          {right}
        </div>
      </div>
      {children}
      {footer}
    </div>
  );
}

export function projectCard(sprint: PublicSprint, project: PublicProject) {
  const award = project.awards[0];
  const awardText = award ? awardName(award) : null;
  const color = project.team.color ?? AMBER;
  const names = project.members.map((m) => m.first_name).join(", ");
  return new ImageResponse(
    (
      <Frame
        right={`Buildathon #${sprint.number}`}
        footer={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  fontSize: 30,
                  color,
                  background: `${color}26`,
                  border: `2px solid ${color}88`,
                }}
              >
                {project.team.name.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 28 }}>{clip(`by ${project.team.name}`, 40)}</span>
                {names && <span style={{ fontSize: 22, color: "#8b949e" }}>{clip(names, 48)}</span>}
              </div>
            </div>
            <span style={{ fontSize: 26, color: AMBER }}>Built in 48h at Quorum Buildathon #{sprint.number}</span>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {awardText && (
            <div style={{ display: "flex", marginBottom: 22 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#1a1206",
                  padding: "8px 20px",
                  borderRadius: 999,
                  background: "linear-gradient(180deg, #fcd581, #f59e0b)",
                }}
              >
                <Star size={24} color="#1a1206" />
                <span>{awardText}</span>
              </div>
            </div>
          )}
          <span style={{ fontSize: 84, lineHeight: 1.02, letterSpacing: "-0.035em", fontWeight: 700 }}>
            {clip(project.fields.project_name || "Untitled project", 34)}
          </span>
          {project.fields.tagline && (
            <span style={{ fontSize: 34, color: "#8b949e", lineHeight: 1.35, marginTop: 18 }}>{clip(project.fields.tagline, 110)}</span>
          )}
        </div>
      </Frame>
    ),
    OG_SIZE,
  );
}

export function recapCard(sprint: PublicSprint, winners: { award: string; project: string }[]) {
  const stats = [
    { v: sprint.shipped, l: "projects" },
    { v: sprint.builders, l: "builders" },
    { v: sprint.teams, l: "teams" },
    { v: sprint.cohorts, l: "cohorts" },
  ].filter((s) => s.v > 0 || s.l !== "cohorts");
  return new ImageResponse(
    (
      <Frame
        right={`Buildathon #${sprint.number} recap`}
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 760 }}>
              {winners.slice(0, 3).map((w) => (
                <div key={w.award} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Star size={22} color={AMBER} />
                  <span style={{ fontSize: 24, color: "#c9d1d9" }}>{clip(`${w.award}: ${w.project}`, 54)}</span>
                </div>
              ))}
            </div>
            <span style={{ fontSize: 26, color: AMBER }}>48 hours · quorumhq.co</span>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 76, lineHeight: 1.04, letterSpacing: "-0.035em", fontWeight: 700 }}>{`Buildathon #${sprint.number}`}</span>
          <div style={{ display: "flex", gap: 48, marginTop: 30 }}>
            {stats.map((s) => (
              <div key={s.l} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 64, fontWeight: 700, color: "#ffffff", lineHeight: 1 }}>{String(s.v)}</span>
                <span style={{ fontSize: 24, color: "#8b949e", marginTop: 6 }}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </Frame>
    ),
    OG_SIZE,
  );
}

/** Before the reveal, or for a page that doesn't exist: the plain Quorum Buildathon card. */
export function fallbackCard() {
  return new ImageResponse(
    (
      <Frame right="Buildathons" footer={<span style={{ fontSize: 26, color: AMBER }}>quorumhq.co</span>}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 80, lineHeight: 1.04, letterSpacing: "-0.035em", fontWeight: 700 }}>Quorum Buildathon</span>
          <span style={{ fontSize: 34, color: "#8b949e", marginTop: 18 }}>48 hours to turn a business idea into something real, with founders from across the network.</span>
        </div>
      </Frame>
    ),
    OG_SIZE,
  );
}
