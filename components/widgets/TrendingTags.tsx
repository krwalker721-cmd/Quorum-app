import { createClient } from "@/lib/supabase/server";
import { TAG_COLOR } from "@/lib/stage";

export default async function TrendingTags() {
  const supabase = createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data } = await supabase
    .from("posts")
    .select("tag")
    .gte("created_at", sevenDaysAgo)
    .not("tag", "is", null);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!row.tag) continue;
    counts[row.tag] = (counts[row.tag] ?? 0) + 1;
  }
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div
      className="p-4 border"
      style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
    >
      <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
        trending_tags
      </p>
      {top.length === 0 ? (
        <p className="font-mono lowercase text-[0.7rem] text-text-faint">no tags yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {top.map(([tag, count]) => {
            const color = TAG_COLOR[tag] ?? "#707070";
            return (
              <span
                key={tag}
                className="font-mono lowercase text-[0.65rem] px-2 py-1 inline-flex items-center gap-1.5"
                style={{
                  border: `1px solid ${color}`,
                  color,
                  background: "transparent",
                }}
              >
                {tag}
                <span className="text-text-faint">· {count}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
