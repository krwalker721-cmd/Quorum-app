import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";
import type { Award } from "@/lib/hackathons/page";

// After the reveal: awards on top, then the gallery of everything built.
// The awards are real (the admin console writes them, and the database makes
// them public at the reveal). The gallery is a PLACEHOLDER until Prompt 10,
// which replaces this file.

const AWARD_LABEL: Record<Award["award_type"], string> = {
  judges_pick: "Judges' pick",
  most_shipped: "Most shipped",
  best_collaboration: "Best collaboration",
  most_likely_to_become_real: "Most likely to become real",
  custom: "Award",
};

export function Awards({ awards }: { awards: Award[] }) {
  if (awards.length === 0) return null;
  return (
    <Tile kicker="Awards" gradient style={{ marginBottom: 16 }} padding="16px 18px">
      <ul className="grid" style={{ gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {awards.map((a) => (
          <li
            key={a.id}
            style={{ border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 10, padding: "11px 12px", background: "rgba(0, 0, 0, 0.15)" }}
          >
            <p style={{ fontSize: 11.5, fontWeight: 600, color: "#f8c56a" }}>
              {a.award_type === "custom" ? a.custom_label : AWARD_LABEL[a.award_type]}
            </p>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>{a.project_name ?? "A project"}</p>
            {a.tagline && <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>{a.tagline}</p>}
            {a.team_name && <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>by {a.team_name}</p>}
          </li>
        ))}
      </ul>
    </Tile>
  );
}

export function GallerySlot() {
  return (
    <Tile kicker="Gallery" style={{ marginBottom: 16 }}>
      <div className={ui.empty}>
        <p className={ui.emptyTitle}>Every project is unsealed. The gallery of what everyone built opens here soon.</p>
      </div>
    </Tile>
  );
}
