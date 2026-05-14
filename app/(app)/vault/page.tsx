import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import Avatar from "@/components/Avatar";
import YourTier from "@/components/widgets/YourTier";
import TopContributors from "@/components/widgets/TopContributors";
import PopularTags from "@/components/widgets/PopularTags";
import { TAG_COLOR } from "@/lib/stage";
import { description, isUnlocked, type Tier, type VaultPost } from "@/lib/vault";

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();
  const tier = (profile?.tier ?? "free") as Tier;

  // Newest first for display, but unlock-index is counted from oldest so the
  // tier_1 "first two" matches "the first two ever published".
  const { data: rows } = await supabase
    .from("vault_posts")
    .select("id, author_id, title, content, credential, tag, read_time_minutes, created_at")
    .order("created_at", { ascending: true });

  const posts: VaultPost[] = (rows ?? []) as VaultPost[];
  const ordered = [...posts].reverse(); // display newest first

  const authorIds = Array.from(
    new Set(posts.map((p) => p.author_id).filter(Boolean) as string[]),
  );
  const { data: authors } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, stage, username")
        .in("id", authorIds)
    : { data: [] as any[] };
  const authorMap = new Map((authors ?? []).map((a: any) => [a.id, a]));
  const oldestIndex = new Map(posts.map((p, i) => [p.id, i] as const));

  return (
    <>
      <TopBar
        title="vault"
        tier={tier.toUpperCase()}
        userId={user.id}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 py-6">
        <div className="lg:col-span-2 space-y-3">
          <p className="font-mono lowercase text-[0.7rem] text-text-faint mb-3 tracking-wider">
            vault — tier_2 exclusive knowledge
          </p>
          {ordered.length === 0 ? (
            <p className="font-mono lowercase text-xs text-text-faint">
              vault is empty for now.
            </p>
          ) : (
            ordered.map((p) => {
              const idx = oldestIndex.get(p.id) ?? 0;
              const unlocked = isUnlocked(tier, idx);
              const author: any = p.author_id ? authorMap.get(p.author_id) : null;
              const color = p.tag ? TAG_COLOR[p.tag] ?? "#707070" : "#707070";

              return (
                <VaultCard
                  key={p.id}
                  post={p}
                  author={author}
                  unlocked={unlocked}
                  tagColor={color}
                />
              );
            })
          )}
        </div>
        <aside className="space-y-4">
          <YourTier tier={tier} />
          <TopContributors />
          <PopularTags />
        </aside>
      </div>
    </>
  );
}

function VaultCard({
  post,
  author,
  unlocked,
  tagColor,
}: {
  post: VaultPost;
  author: any;
  unlocked: boolean;
  tagColor: string;
}) {
  const card = (
    <article
      className="p-5 border transition-colors"
      style={{
        background: "var(--card-elev)",
        borderColor: unlocked ? "var(--border-amber)" : "var(--border)",
        borderStyle: unlocked ? "solid" : "dashed",
        opacity: unlocked ? 1 : 0.45,
      }}
    >
      <header className="flex items-center gap-3 mb-3">
        <Avatar
          name={author?.full_name}
          stage={author?.stage}
          username={author?.username}
          size={32}
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono lowercase text-xs text-text-primary truncate">
            {author?.full_name?.toLowerCase() ?? "—"}
          </p>
          <p className="font-mono lowercase text-[0.65rem] text-text-faint truncate">
            {post.credential ?? ""}
          </p>
        </div>
        {post.tag && (
          <span
            className="font-mono lowercase text-[0.6rem] px-2 py-0.5"
            style={{ border: `1px solid ${tagColor}`, color: tagColor }}
          >
            {post.tag}
          </span>
        )}
      </header>

      <h2 className="font-sans lowercase text-text-primary text-lg leading-snug mb-2">
        {post.title}
      </h2>

      {unlocked ? (
        <p className="text-text-secondary text-[0.92rem] leading-relaxed">
          {description(post.content)}
        </p>
      ) : (
        <p className="font-mono lowercase text-[0.75rem] text-text-faint italic">
          content locked
        </p>
      )}

      <footer className="flex items-center justify-between mt-4">
        <span className="font-mono lowercase text-[0.65rem] text-text-faint">
          {post.read_time_minutes ? `${post.read_time_minutes} min read` : ""}
        </span>
        {unlocked ? (
          <span
            className="font-mono lowercase text-[0.65rem] px-2 py-0.5"
            style={{ border: "1px solid #22c55e", color: "#22c55e" }}
          >
            open →
          </span>
        ) : (
          <span className="font-mono lowercase text-[0.65rem] text-amber">
            upgrade to tier_2 →
          </span>
        )}
      </footer>
    </article>
  );

  return unlocked ? (
    <Link href={`/vault/${post.id}`} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
