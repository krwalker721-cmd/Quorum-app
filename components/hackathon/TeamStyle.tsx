"use client";

// A team's emblem and colour: the badge, and the picker used when creating or
// editing a team. The lists match the matcher's (migration 026).

export const EMBLEMS = ["◆", "▲", "●", "■", "✦", "◉", "⬢", "✳"];
export const COLORS = ["#f59e0b", "#38bdf8", "#22c55e", "#a78bfa", "#f472b6", "#fb923c", "#2dd4bf", "#facc15"];

export function TeamBadge({ name, emblem, color, size = 24 }: { name: string; emblem: string | null; color: string | null; size?: number }) {
  const c = color ?? "#f59e0b";
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        flexShrink: 0,
        fontSize: Math.round(size * 0.5),
        background: `${c}22`,
        border: `1px solid ${c}66`,
        color: c,
      }}
    >
      {emblem || name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function StylePicker({
  emblem,
  color,
  onChange,
}: {
  emblem: string;
  color: string;
  onChange: (next: { emblem: string; color: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Emblem">
        {EMBLEMS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={emblem === e}
            onClick={() => onChange({ emblem: e, color })}
            className="inline-flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              fontSize: 15,
              color,
              background: emblem === e ? `${color}26` : "transparent",
              border: `1px solid ${emblem === e ? `${color}99` : "rgba(255, 255, 255, 0.1)"}`,
            }}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            onClick={() => onChange({ emblem, color: c })}
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              background: c,
              outline: color === c ? "2px solid var(--text-primary)" : "none",
              outlineOffset: 2,
              border: "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}
