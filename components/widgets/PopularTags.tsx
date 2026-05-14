import { createClient } from "@/lib/supabase/server";
import { TAG_COLOR } from "@/lib/stage";

export default async function PopularTags() {
  const supabase = createClient();
  const { data } = await supabase.from("vault_posts").select("tag");

  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    if (!r.tag) continue;
    counts[r.tag] = (counts[r.tag] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <div
      className="p-4 border"
      style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
    >
      <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
        popular_tags
      </p>
      {sorted.length === 0 ? (
        <p className="font-mono lowercase text-[0.7rem] text-text-faint">no tags yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {sorted.map(([tag, count]) => {
            const color = TAG_COLOR[tag] ?? "#707070";
            return (
              <span
                key={tag}
                className="font-mono lowercase text-[0.6rem] px-1.5 py-0.5"
                style={{
                  border: `1px solid ${color}`,
                  color,
                  background: "transparent",
                }}
              >
                {tag} · {count}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
