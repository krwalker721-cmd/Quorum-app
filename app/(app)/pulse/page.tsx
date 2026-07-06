import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import PulseFeed from "@/components/PulseFeed";
import NewPostButton from "@/components/NewPostButton";
import PulseFilterTabs from "@/components/pulse/PulseFilterTabs";
import InTheRoomWidget from "@/components/widgets/InTheRoomWidget";
import MostHelpfulThisWeek from "@/components/widgets/MostHelpfulThisWeek";
import TrendingTags from "@/components/widgets/TrendingTags";
import TerminalFooter from "@/components/ui/TerminalFooter";
import { PostWithAuthor } from "@/components/PostCard";
import { hasDepthRing, isAnniversary, postsMovedTheRoomBatch } from "@/lib/recognition";

export const dynamic = "force-dynamic";

const PAGE = 20;
const TWO_HOURS = 2 * 60 * 60 * 1000;

export default async function PulsePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, full_name")
    .eq("id", user.id)
    .single();

  // ── parallel core fetches ──────────────────────────────────────────────
  const twoHoursAgo = new Date(Date.now() - TWO_HOURS).toISOString();

  const [postsRes, myCohortsRes, recentRepliesRes, membersRes] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, content, tag, room_type, is_anonymous, post_type, cohort_id, reply_count, created_at, author_id, local_hour",
      )
      .eq("post_type", "pulse")
      .is("parent_post_id", null)
      .order("created_at", { ascending: false })
      .limit(PAGE * 2), // pull a wider window so smart-ordering has material
    supabase.from("cohort_members").select("cohort_id").eq("user_id", user.id),
    supabase.from("post_replies").select("post_id").gte("created_at", twoHoursAgo),
    supabase
      .from("profiles")
      .select("id, full_name, stage, username, created_at")
      .eq("status", "approved"),
  ]);

  const postsRaw = postsRes.data ?? [];
  const myCohorts = (myCohortsRes.data ?? []).map((c) => c.cohort_id).filter(Boolean) as string[];
  const activePostIds = new Set((recentRepliesRes.data ?? []).map((r) => r.post_id));
  const members = membersRes.data ?? [];

  // ── cohort peer set ────────────────────────────────────────────────────
  let peerIds: string[] = [];
  if (myCohorts.length > 0) {
    const { data: peers } = await supabase
      .from("cohort_members")
      .select("user_id")
      .in("cohort_id", myCohorts);
    peerIds = Array.from(new Set((peers ?? []).map((p) => p.user_id).filter(Boolean) as string[]));
  }
  const peerSet = new Set(peerIds);

  // ── author hydration ───────────────────────────────────────────────────
  const authorIds = Array.from(
    new Set(postsRaw.map((p) => p.author_id).filter(Boolean) as string[]),
  );

  const { data: authors } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, stage, username, created_at")
        .in("id", authorIds)
    : { data: [] as any[] };
  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));

  const depthEntries = await Promise.all(
    authorIds.map(async (id) => [id, await hasDepthRing(supabase, id)] as const),
  );
  const depthMap = new Map(depthEntries);
  const movedSet = await postsMovedTheRoomBatch(
    supabase,
    postsRaw.map((p) => ({ id: p.id, created_at: p.created_at })),
  );

  // ── decorate + smart-order ─────────────────────────────────────────────
  const decorated: PostWithAuthor[] = postsRaw.map((p) => {
    const author = authorMap.get(p.author_id ?? "") ?? null;
    return {
      ...(p as any),
      author,
      isActive: activePostIds.has(p.id),
      movedTheRoom: movedSet.has(p.id),
      authorDepthRing: p.author_id ? depthMap.get(p.author_id) ?? false : false,
      authorAnniversary: isAnniversary(author?.created_at ?? null),
    };
  });

  function priorityOf(p: PostWithAuthor): number {
    if ((p.room_type === "decision" || p.room_type === "blocker") && p.isActive) return 1;
    const aid = (p as any).author_id;
    if (aid && peerSet.has(aid)) return 2;
    return 3;
  }
  decorated.sort((a, b) => {
    const pa = priorityOf(a);
    const pb = priorityOf(b);
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const initial = decorated.slice(0, PAGE);
  const activeNow = decorated.filter((p) => p.isActive).length;

  return (
    <>
      <TopBar
        title="pulse"
        tier={(profile?.tier ?? "free").toUpperCase()}
        userId={user.id}
        defaultPostType="pulse"
      />
      <div style={{ padding: "18px 24px 8px", maxWidth: 1600 }}>
        {/* Header line */}
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>pulse</h1>
          <span className="font-mono" style={{ fontSize: 9, color: activeNow > 0 ? "var(--green)" : "var(--text-muted)" }}>
            {activeNow > 0 ? `● ${activeNow} active now` : "quiet right now"}
          </span>
        </div>

        <div
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4"
        >
          <div>
            {/* Composer pill + filter tabs */}
            <div style={{ marginBottom: 8 }}>
              <NewPostButton
                userId={user.id}
                defaultPostType="pulse"
                variant="composer"
                currentUserName={profile?.full_name ?? null}
              />
            </div>
            <div style={{ margin: "12px 0" }}>
              <PulseFilterTabs />
            </div>
            <PulseFeed
              initial={initial}
              cohortPeerIds={peerIds}
              currentUserId={user.id}
            />
          </div>
          <aside className="space-y-3">
            <InTheRoomWidget members={members.filter((m) => m.id !== user.id)} />
            <MostHelpfulThisWeek />
            <TrendingTags />
          </aside>
        </div>
        <TerminalFooter />
      </div>
    </>
  );
}
