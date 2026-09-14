import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";
import { STAGE_COLOR } from "@/lib/stage";

export default async function MostHelpfulThisWeek() {
  const supabase = await createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // Replies to pulse posts in last 7 days
  const { data: pulsePostIds } = await supabase
    .from("posts")
    .select("id")
    .eq("post_type", "pulse")
    .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString());

  const pulseIdSet = new Set((pulsePostIds ?? []).map((p) => p.id));

  const { data: replies } = await supabase
    .from("post_replies")
    .select("author_id, post_id")
    .gte("created_at", sevenDaysAgo);

  const counts: Record<string, number> = {};
  for (const r of replies ?? []) {
    if (!r.author_id || !r.post_id || !pulseIdSet.has(r.post_id)) continue;
    counts[r.author_id] = (counts[r.author_id] ?? 0) + 1;
  }

  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const ids = top.map(([id]) => id);
  const { data: profiles } = ids.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, stage, username")
        .in("id", ids)
    : { data: [] as any[] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <Tile kicker="Most helpful this week">
      {top.length === 0 ? (
        <div className={ui.empty}>
          <p className={ui.emptyTitle}>No replies yet this week.</p>
          <p className={ui.emptySub}>Answer someone&apos;s question and your name shows up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {top.map(([id, count]) => {
            const p = profileMap.get(id);
            if (!p) return null;
            const stageColor = (p.stage && STAGE_COLOR[p.stage]) || "var(--text-muted)";
            return (
              <div key={id} className="flex items-center gap-3">
                <div className="rounded-full" style={{ padding: 2, background: "rgba(245, 158, 11, 0.35)" }}>
                  <Avatar name={p.full_name} stage={p.stage} username={p.username} size={26} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ fontSize: 14, color: "var(--text-primary)" }}>
                    {p.full_name ?? "—"}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {p.stage && <span style={{ color: stageColor }}>{p.stage} · </span>}
                    {count} {count === 1 ? "reply" : "replies"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Tile>
  );
}
