import Tile from "@/components/ui/Tile";
import { RUBRIC } from "@/lib/hackathons/judging";

/** The four things judges score, in words, beside the list. */
export default function RubricTile() {
  return (
    <Tile kicker="The rubric" style={{ marginBottom: 16 }}>
      <ul className="flex flex-col" style={{ gap: 12 }}>
        {RUBRIC.map((r) => (
          <li key={r.key}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{r.label}</p>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.5 }}>{r.question}</p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>
              1 · {r.low} &nbsp;→&nbsp; 5 · {r.high}
            </p>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.55 }}>
        Awards are light: no losers and no full ranking. Scores only help the admins choose who gets recognised.
      </p>
    </Tile>
  );
}
