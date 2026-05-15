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
    return "#707070";
  }
  function sizeFor(rank: number) {
    if (rank === 0) return "1.15rem";
    if (rank === 1) return "0.95rem";
    if (rank === 2) return "0.85rem";
    return "0.7rem";
  }

  return (
    <div
      className="p-4 border"
      style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
    >
      <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
        trending_tags
      </p>
      {ranked.length === 0 ? (
        <p className="font-mono lowercase text-[0.7rem] text-text-faint">no tags yet.</p>
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
