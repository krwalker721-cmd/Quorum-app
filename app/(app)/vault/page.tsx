import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import VaultPage from "@/components/vault/VaultPage";

export const dynamic = "force-dynamic";

export default async function Vault({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();
  const tier = (profile?.tier ?? "free").toUpperCase();

  const tab = (searchParams.tab as "library" | "notes" | "community_wisdom") ?? "library";

  // --- global stat strip (always alive)
  const [{ count: savedByCommunity }, { count: notesWritten }, { count: wisdomPreserved }] =
    await Promise.all([
      supabase.from("saved_items").select("id", { count: "exact", head: true }),
      supabase.from("notes").select("id", { count: "exact", head: true }),
      supabase.from("community_wisdom").select("id", { count: "exact", head: true }),
    ]);

  // --- library: load my saved items + hydrate originals
  const { data: savedRows } = await supabase
    .from("saved_items")
    .select("id, item_type, item_id, personal_note, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const saved = savedRows ?? [];
  const postIds = saved.filter((s) => s.item_type !== "project").map((s) => s.item_id);
  const projectIds = saved.filter((s) => s.item_type === "project").map((s) => s.item_id);

  const { data: postRows } = postIds.length
    ? await supabase
        .from("posts")
        .select("id, content, tag, is_anonymous, post_type, author_id, created_at")
        .in("id", postIds)
    : { data: [] as any[] };
  const { data: projectRows } = projectIds.length
    ? await supabase
        .from("projects")
        .select("id, title, description, category, owner_id, created_at")
        .in("id", projectIds)
    : { data: [] as any[] };

  const authorIds = Array.from(
    new Set([
      ...((postRows ?? []).map((p: any) => p.author_id).filter(Boolean) as string[]),
      ...((projectRows ?? []).map((p: any) => p.owner_id).filter(Boolean) as string[]),
    ]),
  );
  const { data: authors } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, stage, username")
        .in("id", authorIds)
    : { data: [] as any[] };
  const authorMap = new Map((authors ?? []).map((a: any) => [a.id, a]));

  const postMap = new Map((postRows ?? []).map((p: any) => [p.id, p]));
  const projectMap = new Map((projectRows ?? []).map((p: any) => [p.id, p]));

  const libraryItems = saved.map((s) => {
    if (s.item_type === "project") {
      const proj: any = projectMap.get(s.item_id);
      return {
        ...s,
        original: proj
          ? {
              id: proj.id,
              kind: "project" as const,
              content: proj.description ?? proj.title ?? "",
              title: proj.title,
              author: authorMap.get(proj.owner_id) ?? null,
              created_at: proj.created_at,
              tag: proj.category ?? null,
              is_anonymous: false,
            }
          : null,
      };
    }
    const post: any = postMap.get(s.item_id);
    return {
      ...s,
      original: post
        ? {
            id: post.id,
            kind: post.post_type === "pulse" ? ("pulse_post" as const) : ("cohort_post" as const),
            content: post.content,
            title: null,
            author: post.is_anonymous ? null : authorMap.get(post.author_id) ?? null,
            created_at: post.created_at,
            tag: post.tag,
            is_anonymous: post.is_anonymous,
          }
        : null,
    };
  });

  // --- notes
  const [{ data: notesData }, { data: collectionsData }] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, content, collection_id, tags, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("note_collections")
      .select("id, name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  // --- community wisdom (approved)
  const { data: wisdomRaw } = await supabase
    .from("community_wisdom")
    .select("id, post_id, nominated_by, nomination_reason, approved_at, created_at")
    .order("approved_at", { ascending: false })
    .limit(60);

  const wisdomPostIds = (wisdomRaw ?? []).map((w) => w.post_id);
  const wisdomNomIds = (wisdomRaw ?? []).map((w) => w.nominated_by).filter(Boolean) as string[];

  const { data: wisdomPosts } = wisdomPostIds.length
    ? await supabase
        .from("posts")
        .select("id, content, tag, is_anonymous, reply_count, author_id, created_at")
        .in("id", wisdomPostIds)
    : { data: [] as any[] };

  const wisdomAuthorIds = Array.from(
    new Set([
      ...((wisdomPosts ?? []).map((p: any) => p.author_id).filter(Boolean) as string[]),
      ...wisdomNomIds,
    ]),
  );
  const { data: wisdomAuthors } = wisdomAuthorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, stage, username")
        .in("id", wisdomAuthorIds)
    : { data: [] as any[] };
  const wisdomAuthorMap = new Map((wisdomAuthors ?? []).map((a: any) => [a.id, a]));
  const wisdomPostMap = new Map((wisdomPosts ?? []).map((p: any) => [p.id, p]));

  const wisdom = (wisdomRaw ?? [])
    .map((w) => {
      const p: any = wisdomPostMap.get(w.post_id);
      if (!p) return null;
      return {
        id: w.id,
        post_id: w.post_id,
        approved_at: w.approved_at,
        nomination_reason: w.nomination_reason,
        post: {
          content: p.content,
          tag: p.tag,
          reply_count: p.reply_count ?? 0,
          author: p.is_anonymous ? null : wisdomAuthorMap.get(p.author_id) ?? null,
          created_at: p.created_at,
        },
        nominator: w.nominated_by ? wisdomAuthorMap.get(w.nominated_by) ?? null : null,
      };
    })
    .filter(Boolean);

  // --- empty-state assist: top replied pulse posts (last 7d) for community_wisdom empty state
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: topReplied } = await supabase
    .from("posts")
    .select("id, content, tag, reply_count, author_id, is_anonymous, created_at")
    .eq("post_type", "pulse")
    .gte("created_at", sevenDaysAgo)
    .order("reply_count", { ascending: false })
    .limit(3);

  const trIds = (topReplied ?? []).map((p: any) => p.author_id).filter(Boolean) as string[];
  const { data: trAuthors } = trIds.length
    ? await supabase.from("profiles").select("id, full_name, stage, username").in("id", trIds)
    : { data: [] as any[] };
  const trMap = new Map((trAuthors ?? []).map((a: any) => [a.id, a]));
  const topRepliedHydrated = (topReplied ?? []).map((p: any) => ({
    ...p,
    author: p.is_anonymous ? null : trMap.get(p.author_id) ?? null,
  }));

  // --- live counter: pulse posts in last 24h (the "could end up here" stat)
  const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { count: pulseRecent } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("post_type", "pulse")
    .gte("created_at", oneDayAgo);

  return (
    <>
      <TopBar title="vault" tier={tier} userId={user.id} />
      <VaultPage
        currentUserId={user.id}
        initialTab={tab}
        stats={{
          savedByCommunity: savedByCommunity ?? 0,
          notesWritten: notesWritten ?? 0,
          wisdomPreserved: wisdomPreserved ?? 0,
        }}
        library={libraryItems as any}
        notes={(notesData ?? []) as any}
        collections={(collectionsData ?? []) as any}
        wisdom={wisdom as any}
        topRepliedPulse={topRepliedHydrated as any}
        pulseRecent={pulseRecent ?? 0}
      />
    </>
  );
}
