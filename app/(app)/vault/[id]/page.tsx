import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import Avatar from "@/components/Avatar";
import HandshakeButton from "@/components/HandshakeButton";
import Markdown from "@/components/Markdown";
import { TAG_COLOR } from "@/lib/stage";
import { isUnlocked, type Tier, type VaultPost } from "@/lib/vault";

export const dynamic = "force-dynamic";

export default async function VaultDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();
  const tier = (profile?.tier ?? "free") as Tier;

  const { data: post } = await supabase
    .from("vault_posts")
    .select("id, author_id, title, content, credential, tag, read_time_minutes, created_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!post) notFound();
  const vp = post as VaultPost;

  // Determine this post's index from oldest to apply tier_1 first-two rule.
  const { data: ordered } = await supabase
    .from("vault_posts")
    .select("id")
    .order("created_at", { ascending: true });
  const idx = (ordered ?? []).findIndex((r: any) => r.id === vp.id);
  const unlocked = isUnlocked(tier, idx);

  const author = vp.author_id
    ? (
        await supabase
          .from("profiles")
          .select("id, full_name, stage, username")
          .eq("id", vp.author_id)
          .maybeSingle()
      ).data
    : null;

  // Related posts — same tag, excluding self, 3 newest.
  const { data: relatedRaw } = vp.tag
    ? await supabase
        .from("vault_posts")
        .select("id, title, author_id, credential, tag, read_time_minutes")
        .eq("tag", vp.tag)
        .neq("id", vp.id)
        .order("created_at", { ascending: false })
        .limit(3)
    : { data: [] as any[] };
  const related = relatedRaw ?? [];

  const tagColor = vp.tag ? TAG_COLOR[vp.tag] ?? "#707070" : "#707070";

  return (
    <>
      <TopBar title="vault" tier={tier.toUpperCase()} userId={user.id} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 py-6">
        <div className="lg:col-span-2 space-y-6">
          <Link
            href="/vault"
            className="font-mono lowercase text-[0.7rem] text-text-faint hover:text-amber inline-block"
          >
            ← back to vault
          </Link>

          {/* author card */}
          <div
            className="p-4 border flex items-center gap-4"
            style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
          >
            <Avatar
              name={author?.full_name}
              stage={author?.stage}
              username={author?.username}
              size={44}
            />
            <div className="flex-1 min-w-0">
              <p className="font-mono lowercase text-sm text-text-primary truncate">
                {author?.full_name?.toLowerCase() ?? "—"}
              </p>
              <p className="font-mono lowercase text-[0.7rem] text-text-faint truncate">
                {vp.credential ?? ""}
              </p>
            </div>
            {author && author.id !== user.id && (
              <HandshakeButton
                currentUserId={user.id}
                recipientId={author.id}
                recipientName={author.full_name}
              />
            )}
          </div>

          {vp.tag && (
            <span
              className="font-mono lowercase text-[0.65rem] px-2 py-0.5 inline-block"
              style={{ border: `1px solid ${tagColor}`, color: tagColor }}
            >
              {vp.tag}
            </span>
          )}

          {unlocked ? (
            <article
              className="p-6 border"
              style={{
                background: "var(--card-elev)",
                borderColor: "var(--border-amber)",
              }}
            >
              <Markdown source={vp.content} />
              {vp.read_time_minutes && (
                <p className="font-mono lowercase text-[0.65rem] text-text-faint mt-6">
                  {vp.read_time_minutes} min read
                </p>
              )}
            </article>
          ) : (
            <article
              className="p-6 border"
              style={{
                background: "var(--card-elev)",
                borderColor: "var(--border)",
                borderStyle: "dashed",
                opacity: 0.6,
              }}
            >
              <h1 className="font-sans lowercase text-text-primary text-2xl mb-3">
                {vp.title}
              </h1>
              <p className="font-mono lowercase text-[0.8rem] text-text-faint italic mb-4">
                content locked
              </p>
              <p className="font-mono lowercase text-[0.75rem] text-amber">
                upgrade to tier_2 →
              </p>
            </article>
          )}
        </div>

        <aside className="space-y-4">
          <div
            className="p-4 border"
            style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
          >
            <p className="font-mono lowercase text-[0.65rem] text-text-faint tracking-wider mb-3">
              related
            </p>
            {related.length === 0 ? (
              <p className="font-mono lowercase text-[0.7rem] text-text-faint">
                nothing related yet.
              </p>
            ) : (
              <div className="space-y-3">
                {related.map((r: any) => (
                  <Link
                    key={r.id}
                    href={`/vault/${r.id}`}
                    className="block pb-3"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <p className="text-text-secondary text-[0.85rem] leading-snug">
                      {r.title}
                    </p>
                    <p className="font-mono lowercase text-[0.6rem] text-text-faint mt-1">
                      {r.read_time_minutes ? `${r.read_time_minutes} min` : ""}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
