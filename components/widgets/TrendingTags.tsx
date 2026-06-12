import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ROOM_TYPE_COLOR, TAG_COLOR } from "@/lib/stage";

export default async function TrendingTags() {
  const supabase = createClient();
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

  function colorFor(tag: string, rank: number) {
    if (rank === 0) return "#f59e0b";
    if (rank < 3) return "rgba(245, 158, 11, 0.7)";
    return "#6e7681";
  }
  function sizeFor(rank: number) {
    if (rank === 0) return "1.15rem";
    if (rank === 1) return "0.95rem";
    if (rank === 2) return "0.85rem";
    return "0.7rem";
  }

  return (
    <div
      className="side-widget"
      style={{ "--w-accent": "#38bdf8" } as React.CSSProperties}
    >
      <div className="side-widget-head">
        <span className="side-widget-glyph" aria-hidden>#</span>
        <p className="side-widget-label">trending_tags</p>
        {ranked.length > 0 && <span className="side-widget-meta">7d</span>}
      </div>
      {ranked.length === 0 ? (
        <div className="empty-panel compact">
          <p className="empty-panel-title">no tags trending yet.</p>
          <p className="empty-panel-sub">tags pick up as the week&apos;s conversations build.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-2 items-baseline">
          {ranked.map(([tag, count], rank) => (
            <Link
              key={tag}
              href={`/pulse?tag=${encodeURIComponent(tag)}`}
              className="font-mono lowercase hover:underline transition-opacity"
              style={{
                color: colorFor(tag, rank),
                fontSize: sizeFor(rank),
                opacity: rank < 3 ? 1 : 0.7,
              }}
              title={`${count} posts`}
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
