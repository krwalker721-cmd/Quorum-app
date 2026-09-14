import { ImageResponse } from "next/og";

// The card shown when a quorumhq.co link is shared (iMessage, Slack, X,
// LinkedIn). Generated once at build time. Satori lays this out, so every
// element with more than one child needs display: flex, and there is no
// background-clip text: the landing page's gradient headline is flattened to
// solid colours here.

export const alt = "Quorum: the honest version of LinkedIn";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const AMBER = "#f59e0b";

// The logo's hexagon: six nodes around a hub (components/LogoMark.tsx), static.
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

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0b0e13",
          backgroundImage:
            "radial-gradient(circle at 18% 0%, rgba(245,158,11,0.24), rgba(245,158,11,0) 55%), radial-gradient(circle at 92% 100%, rgba(248,197,106,0.12), rgba(248,197,106,0) 50%)",
          color: "#e6edf3",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Mark size={52} />
          <span style={{ fontSize: 34, letterSpacing: "0.02em" }}>quorum</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* One span per word with a fixed margin: Satori trims spaces at the
              edges of a span and spaces multi-word spans unevenly, which ran
              "honest" into "version". */}
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 76, lineHeight: 1.05, letterSpacing: "-0.035em" }}>
            {["The", "honest", "version", "of", "LinkedIn."].map((word, i, words) => (
              <span
                key={word}
                style={{
                  color: word === "honest" ? AMBER : undefined,
                  marginRight: i < words.length - 1 ? 20 : 0,
                }}
              >
                {word}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: "#8b949e", lineHeight: 1.4 }}>
            A private network of founders, anchored by a cohort of twelve you meet every week.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#6e7681" }}>
          <span>quorumhq.co</span>
          <span style={{ color: AMBER }}>Twelve founders. One room. Every week.</span>
        </div>
      </div>
    ),
    size,
  );
}
