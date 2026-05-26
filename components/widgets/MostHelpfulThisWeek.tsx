import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import { STAGE_COLOR } from "@/lib/stage";

export default async function MostHelpfulThisWeek() {
  const supabase = createClient();
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
    <div
      className="p-4 border"
      style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
    >
      <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
        most_helpful_this_week
      </p>
      {top.length === 0 ? (
        <p className="font-mono lowercase text-[0.7rem] text-text-faint">
          no replies yet this week.
        </p>
      ) : (
        <div className="space-y-3">
          {top.map(([id, count]) => {
            const p = profileMap.get(id);
            if (!p) return null;
            return (
              <div key={id} className="flex items-center gap-2.5">
                <div
                  className="rounded-full"
                  style={{
                    padding: 2,
                    background: "rgba(245, 158, 11, 0.35)",
                  }}
                >
                  <Avatar
                    name={p.full_name}
                    stage={p.stage}
                    username={p.username}
                    size={22}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono lowercase text-[0.7rem] text-text-secondary truncate">
                    {p.full_name?.toLowerCase() ?? "—"}
                  </p>
                  <div className="flex items-center gap-2">
                    {p.stage && (
                      <span
                        className="font-mono lowercase text-[0.55rem] px-1.5 py-0.5"
                        style={{
                          border: `1px solid ${STAGE_COLOR[p.stage] ?? "#6e7681"}`,
                          color: STAGE_COLOR[p.stage] ?? "#6e7681",
                        }}
                      >
                        {p.stage}
                      </span>
                    )}
                    <span className="font-mono lowercase text-[0.6rem] text-text-faint">
                      {count} {count === 1 ? "reply" : "replies"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p
        className="font-sans lowercase text-[0.65rem] text-text-faint mt-4 pt-3 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        founders showing up for the room
      </p>
    </div>
  );
}
