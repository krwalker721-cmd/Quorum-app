import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import StatStrip from "@/components/StatStrip";
import Feed from "@/components/Feed";
import WeeklyCheckin from "@/components/widgets/WeeklyCheckin";
import ActiveNow from "@/components/widgets/ActiveNow";
import VaultPreview from "@/components/widgets/VaultPreview";
import CohortNetwork from "@/components/viz/CohortNetwork";
import ActivityHeatmap from "@/components/viz/ActivityHeatmap";
import StageBreakdown from "@/components/viz/StageBreakdown";
import { PostWithAuthor } from "@/components/PostCard";
import RecognitionNotices from "@/components/RecognitionNotices";
import { hasDepthRing, isAnniversary, postsMovedTheRoomBatch } from "@/lib/recognition";

export const dynamic = "force-dynamic";

const COHORT_MAX = 12;

export default async function HomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Layout already redirects, but tsc needs the guard.
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, stage, tier, trust_score")
    .eq("id", user.id)
    .single();

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, stage, username, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  const memberList = members ?? [];

  // Posts with author hydrated
  const { data: postsRaw } = await supabase
    .from("posts")
    .select("id, content, tag, is_anonymous, post_type, reply_count, created_at, author_id, local_hour")
    .order("created_at", { ascending: false })
    .limit(40);

  const authorMap = new Map(memberList.map((m) => [m.id, m]));

  // Recognition hydration — figure out which posts "moved the room" and which
  // authors have a depth ring / anniversary today. Depth ring is per-author so
  // we batch by distinct author across the visible feed.
  const visibleAuthorIds = Array.from(
    new Set((postsRaw ?? []).map((p) => p.author_id).filter(Boolean) as string[]),
  );
  const depthEntries = await Promise.all(
    visibleAuthorIds.map(async (id) => [id, await hasDepthRing(supabase, id)] as const),
  );
  const depthMap = new Map(depthEntries);
  const movedSet = await postsMovedTheRoomBatch(
    supabase,
    (postsRaw ?? []).map((p) => ({ id: p.id, created_at: p.created_at })),
  );

  const initialPosts: PostWithAuthor[] = (postsRaw ?? []).map((p) => {
    const author = authorMap.get(p.author_id ?? "") ?? null;
    return {
      ...p,
      author,
      movedTheRoom: movedSet.has(p.id),
      authorDepthRing: p.author_id ? depthMap.get(p.author_id) ?? false : false,
      authorAnniversary: isAnniversary(author?.created_at ?? null),
    };
  });

  // Unseen one-time recognition notices (first honest, connector)
  const { data: notices } = await supabase
    .from("recognition_notices")
    .select("id, kind, payload")
    .eq("user_id", user.id)
    .is("seen_at", null)
    .order("created_at", { ascending: true })
    .limit(3);

  // posts in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { count: posts7d } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);

  const { data: recentPostTimes } = await supabase
    .from("posts")
    .select("created_at")
    .gte("created_at", sevenDaysAgo);
  const heatmapTimestamps = (recentPostTimes ?? []).map((r) => r.created_at);

  // stage counts
  const stageCounts: Record<string, number> = { idea: 0, "pre-seed": 0, seed: 0, series_a: 0 };
  memberList.forEach((m) => {
    if (m.stage && stageCounts[m.stage] !== undefined) stageCounts[m.stage] += 1;
  });

  return (
    <>
      <TopBar title="home" tier={(profile?.tier ?? "free").toUpperCase()} userId={user.id} />
      <RecognitionNotices notices={(notices ?? []) as any} />
      <StatStrip
        members={memberList.length}
        activeNow={1}
        posts7d={posts7d ?? 0}
        cohortFill={memberList.length}
        cohortMax={COHORT_MAX}
        trustScore={profile?.trust_score ?? 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 py-6">
        <div className="lg:col-span-2 space-y-6">
          <Feed initial={initialPosts} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <CohortNetwork members={memberList.filter((m) => m.id !== user.id)} />
            <ActivityHeatmap posts7d={posts7d ?? 0} timestamps={heatmapTimestamps} />
            <StageBreakdown counts={stageCounts} />
          </div>
        </div>

        <aside className="space-y-4">
          <WeeklyCheckin userId={user.id} />
          <ActiveNow members={memberList.filter((m) => m.id !== user.id)} currentUserId={user.id} />
          <VaultPreview />
        </aside>
      </div>
    </>
  );
}
