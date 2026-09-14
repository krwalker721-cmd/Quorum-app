import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";

export default async function TrendingTags() {
  const supabase = await createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data } = await supabase
    .from("posts")
    .select("tag, room_type")
    .eq("post_type", "pulse")
    .gte("created_at", sevenDaysAgo);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = (row as any).room_type ?? row.tag;
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  function colorFor(rank: number) {
    if (rank === 0) return "#f59e0b";
    if (rank < 3) return "rgba(245, 158, 11, 0.75)";
    return "var(--text-muted)";
  }
  function sizeFor(rank: number) {
    if (rank === 0) return 16;
    if (rank === 1) return 14;
    if (rank === 2) return 13;
    return 12;
  }

  return (
    <Tile kicker="Trending tags" right={ranked.length > 0 ? "Last 7 days" : undefined}>
      {ranked.length === 0 ? (
        <div className={ui.empty}>
          <p className={ui.emptyTitle}>No tags trending yet.</p>
          <p className={ui.emptySub}>Tags pick up as the week&apos;s conversations build.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-2 items-baseline">
          {ranked.map(([tag, count], rank) => (
            <Link
              key={tag}
              href={`/pulse?tag=${encodeURIComponent(tag)}`}
              className="hover:underline"
              style={{ color: colorFor(rank), fontSize: sizeFor(rank) }}
              title={`${count} ${count === 1 ? "post" : "posts"}`}
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}
    </Tile>
  );
}
