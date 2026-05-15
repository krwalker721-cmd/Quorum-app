import { createClient } from "@/lib/supabase/server";
import { ROOM_TYPE_COLOR, TAG_COLOR } from "@/lib/stage";
import FoundersInRoomCount from "@/components/pulse/FoundersInRoomCount";
import InTheRoomGrid from "@/components/pulse/InTheRoomGrid";
import ActivityTicker from "@/components/pulse/ActivityTicker";

type Member = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
};

export default async function HeaderZone({ members }: { members: Member[] }) {
  const supabase = createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).getTime();

  // This week's conversation: most-used room_type (falling back to tag) across pulse posts in last 7d.
  const { data: weekPosts } = await supabase
    .from("posts")
    .select("tag, room_type")
    .eq("post_type", "pulse")
    .gte("created_at", sevenDaysAgo);

  const counts: Record<string, number> = {};
  for (const row of weekPosts ?? []) {
    const key = (row as any).room_type ?? row.tag;
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const top3 = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Recent activity for the ticker (last 10 minutes — posts + replies).
  const { data: recentPosts } = await supabase
    .from("posts")
    .select("room_type, tag, author_id, created_at")
    .eq("post_type", "pulse")
    .gte("created_at", new Date(tenMinutesAgo).toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: recentReplies } = await supabase
    .from("post_replies")
    .select("post_id, author_id, created_at")
    .gte("created_at", new Date(tenMinutesAgo).toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  const authorIds = Array.from(
    new Set(
      [
        ...((recentPosts ?? []).map((p) => p.author_id)),
        ...((recentReplies ?? []).map((r) => r.author_id)),
      ].filter(Boolean) as string[],
    ),
  );
  const replyPostIds = Array.from(
    new Set((recentReplies ?? []).map((r) => r.post_id).filter(Boolean) as string[]),
  );

  const [{ data: tickerAuthors }, { data: replyPosts }] = await Promise.all([
    authorIds.length
      ? supabase.from("profiles").select("id, username").in("id", authorIds)
      : Promise.resolve({ data: [] as any[] }),
    replyPostIds.length
      ? supabase
          .from("posts")
          .select("id, room_type, tag, post_type")
          .in("id", replyPostIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const authorMap = new Map((tickerAuthors ?? []).map((a) => [a.id, a.username]));
  const postMap = new Map((replyPosts ?? []).map((p) => [p.id, p]));

  const initialEvents = [
    ...((recentPosts ?? []).map((p) => ({
      kind: "post" as const,
      tag: (p as any).room_type ?? p.tag ?? null,
      username: authorMap.get(p.author_id ?? "") ?? null,
      at: new Date(p.created_at).getTime(),
    }))),
    ...((recentReplies ?? [])
      .filter((r) => postMap.get(r.post_id ?? "")?.post_type === "pulse")
      .map((r) => {
        const post = postMap.get(r.post_id ?? "");
        return {
          kind: "reply" as const,
          tag: post?.room_type ?? post?.tag ?? null,
          username: authorMap.get(r.author_id ?? "") ?? null,
          at: new Date(r.created_at).getTime(),
        };
      })),
  ].sort((a, b) => b.at - a.at);

  const cardBase: React.CSSProperties = {
    background: "var(--bg2, var(--card-elev))",
    borderColor: "rgba(245, 158, 11, 0.18)",
  };

  const topTag = top3[0];
  const secondTag = top3[1];
  const thirdTag = top3[2];

  function tagColor(t: string) {
    return ROOM_TYPE_COLOR[t] ?? TAG_COLOR[t] ?? "#f59e0b";
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1 — founders in the room */}
      <div className="p-4 border pulse-card-amber-glow" style={cardBase}>
        <FoundersInRoomCount />
        <p className="font-mono lowercase text-[0.65rem] text-text-faint mt-2 tracking-wider">
          founders in the room right now
        </p>
      </div>

      {/* Card 2 — this week's conversation */}
      <div className="p-4 border" style={cardBase}>
        <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
          this week the room is talking about
        </p>
        {topTag ? (
          <div className="space-y-2">
            <span
              className="inline-block font-mono lowercase text-sm px-3 py-1.5"
              style={{
                background: `${tagColor(topTag[0])}22`,
                color: tagColor(topTag[0]),
                border: `1px solid ${tagColor(topTag[0])}`,
              }}
            >
              #{topTag[0]}
            </span>
            <div className="flex flex-wrap gap-2">
              {secondTag && (
                <span
                  className="font-mono lowercase text-[0.65rem] px-2 py-0.5 border"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  #{secondTag[0]}
                </span>
              )}
              {thirdTag && (
                <span
                  className="font-mono lowercase text-[0.65rem] px-2 py-0.5 border"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  #{thirdTag[0]}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="font-mono lowercase text-[0.7rem] text-text-faint">
            no conversation yet this week.
          </p>
        )}
      </div>

      {/* Card 3 — activity ticker */}
      <div className="p-4 border" style={cardBase}>
        <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
          live activity
        </p>
        <ActivityTicker initialEvents={initialEvents} />
      </div>

      {/* Card 4 — who's here */}
      <div className="p-4 border" style={cardBase}>
        <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
          in the room
        </p>
        <InTheRoomGrid members={members} max={12} size={26} />
      </div>
    </div>
  );
}
