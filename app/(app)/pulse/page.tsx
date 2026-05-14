import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import PulseFeed from "@/components/PulseFeed";
import ActiveNow from "@/components/widgets/ActiveNow";
import VaultPreview from "@/components/widgets/VaultPreview";
import TrendingTags from "@/components/widgets/TrendingTags";
import { PostWithAuthor } from "@/components/PostCard";
import { hasDepthRing, isAnniversary, postsMovedTheRoomBatch } from "@/lib/recognition";

export const dynamic = "force-dynamic";

const PAGE = 20;

export default async function PulsePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  const { data: postsRaw } = await supabase
    .from("posts")
    .select(
      "id, content, tag, is_anonymous, post_type, reply_count, created_at, author_id, local_hour",
    )
    .eq("post_type", "pulse")
    .order("created_at", { ascending: false })
    .limit(PAGE);

  const authorIds = Array.from(
    new Set((postsRaw ?? []).map((p) => p.author_id).filter(Boolean) as string[]),
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
    (postsRaw ?? []).map((p) => ({ id: p.id, created_at: p.created_at })),
  );

  const initial: PostWithAuthor[] = (postsRaw ?? []).map((p) => {
    const author = authorMap.get(p.author_id ?? "") ?? null;
    return {
      ...p,
      author,
      movedTheRoom: movedSet.has(p.id),
      authorDepthRing: p.author_id ? depthMap.get(p.author_id) ?? false : false,
      authorAnniversary: isAnniversary(author?.created_at ?? null),
    };
  });

  // Approved cohort members for ActiveNow
  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, stage, username, created_at")
    .eq("status", "approved");

  return (
    <>
      <TopBar
        title="pulse"
        tier={(profile?.tier ?? "free").toUpperCase()}
        userId={user.id}
        defaultPostType="pulse"
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 py-6">
        <div className="lg:col-span-2">
          <PulseFeed initial={initial} />
        </div>
        <aside className="space-y-4">
          <ActiveNow
            members={(members ?? []).filter((m) => m.id !== user.id)}
            currentUserId={user.id}
          />
          <TrendingTags />
          <VaultPreview />
        </aside>
      </div>
    </>
  );
}
