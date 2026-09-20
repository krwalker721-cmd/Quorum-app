// A small mark for each block in "inside quorum", so the four features read as
// four things rather than four paragraphs. Same language as the page's two big
// visuals: amber hairlines, geometry only — circles are people, squares are
// things being built. Static (these are 44px; motion at that size is noise)
// and decorative, so they stay out of the accessibility tree.

export type GlyphName = "cohort" | "pulse" | "collab" | "vault";

const LINE = "rgba(245,158,11,0.55)";
const FAINT = "rgba(255,255,255,0.14)";

// Seats around one room, the cohort ring in miniature. Eight dots on a drawn
// circle, deliberately not six on an implied hexagon — that is the Quorum
// logo, and a feature mark should not read as the brand mark.
function Cohort() {
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return { x: 22 + 13 * Math.cos(a), y: 22 + 13 * Math.sin(a) };
  });
  return (
    <>
      <circle cx={22} cy={22} r={13} fill="none" stroke="rgba(245,158,11,0.3)" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.4} fill="#f59e0b" />
      ))}
    </>
  );
}

// A signal across the network: the feed's rhythm, not a chart.
function Pulse() {
  return (
    <>
      <path
        d="M6 22h7l4-8 5 16 4-10h12"
        fill="none"
        stroke={LINE}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={38} cy={22} r={2.6} fill="#f59e0b" />
    </>
  );
}

// Three projects, linked — CollabWeave at a glance.
function Collab() {
  const sq = (x: number, y: number) => (
    <rect x={x - 5} y={y - 5} width={10} height={10} rx={2.5} fill="none" stroke={LINE} />
  );
  return (
    <>
      <path d="M22 11 10 31h24z" fill="none" stroke="rgba(245,158,11,0.28)" strokeDasharray="2 3" />
      {sq(22, 11)}
      {sq(10, 31)}
      {sq(34, 31)}
    </>
  );
}

// What the network has already worked out, stacked and kept.
function Vault() {
  return (
    <>
      <rect x={10} y={26} width={24} height={8} rx={3} fill="none" stroke={FAINT} />
      <rect x={12} y={18} width={20} height={8} rx={3} fill="none" stroke={FAINT} />
      <rect x={10} y={10} width={24} height={8} rx={3} fill="none" stroke={LINE} />
      <circle cx={22} cy={14} r={1.8} fill="#f59e0b" />
    </>
  );
}

const GLYPHS: Record<GlyphName, () => React.JSX.Element> = {
  cohort: Cohort,
  pulse: Pulse,
  collab: Collab,
  vault: Vault,
};

export default function ProductGlyph({ name }: { name: GlyphName }) {
  const Shape = GLYPHS[name];
  return (
    <svg viewBox="0 0 44 44" width={44} height={44} aria-hidden focusable="false">
      <Shape />
    </svg>
  );
}
