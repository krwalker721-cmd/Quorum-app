import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import LogoMark from "@/components/LogoMark";
import SignOutButton from "@/components/SignOutButton";
import ApproveButton from "./ApproveButton";
import TierSelect from "./TierSelect";
import VaultNominationActions from "./VaultNominationActions";
import { unlockAdmin, lockAdmin } from "./actions";
import { isAdminUnlocked } from "./session";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isAdminUnlocked()) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <LogoMark size={44} />
            <h1 className="font-mono lowercase text-text-primary text-lg mt-4 tracking-wide">quorum / admin</h1>
            <p className="font-mono lowercase text-text-faint text-xs mt-1">enter access code</p>
          </div>

          <form action={unlockAdmin} className="bg-card border border-border p-6 space-y-4">
            <div>
              <label>access code</label>
              <input type="password" name="code" required autoFocus autoComplete="off" />
            </div>

            {searchParams.error && (
              <p className="font-mono text-xs text-red-400 lowercase">invalid code.</p>
            )}

            <button
              type="submit"
              className="w-full font-mono lowercase text-xs py-2.5 bg-amber text-bg hover:opacity-90"
            >
              unlock
            </button>
          </form>
        </div>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: pending, error } = await admin
    .from("profiles")
    .select("id, full_name, email, what_they_are_building, stage, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const { data: approved } = await admin
    .from("profiles")
    .select("id, full_name, email, username, tier, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  const { data: vaultNoms } = await admin
    .from("vault_nominations")
    .select("id, post_id, nominated_by, reason, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const nomPostIds = (vaultNoms ?? []).map((n) => n.post_id);
  const nomUserIds = (vaultNoms ?? []).map((n) => n.nominated_by).filter(Boolean) as string[];
  const { data: nomPosts } = nomPostIds.length
    ? await admin
        .from("posts")
        .select("id, content, tag, author_id, is_anonymous, created_at")
        .in("id", nomPostIds)
    : { data: [] as any[] };
  const nomAuthorIds = Array.from(
    new Set([
      ...((nomPosts ?? []).map((p: any) => p.author_id).filter(Boolean) as string[]),
      ...nomUserIds,
    ]),
  );
  const { data: nomProfiles } = nomAuthorIds.length
    ? await admin
        .from("profiles")
        .select("id, full_name, username")
        .in("id", nomAuthorIds)
    : { data: [] as any[] };
  const nomPostMap = new Map((nomPosts ?? []).map((p: any) => [p.id, p]));
  const nomProfileMap = new Map((nomProfiles ?? []).map((p: any) => [p.id, p]));

  return (
    <main className="min-h-screen">
      <nav className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={24} />
            <span className="font-mono lowercase text-text-primary text-sm tracking-wide">quorum / admin</span>
          </div>
          <div className="flex items-center gap-2">
            <form action={lockAdmin}>
              <button
                type="submit"
                className="font-mono lowercase text-[0.65rem] px-2.5 py-1.5 border text-text-muted hover:text-text-primary"
                style={{ borderColor: "var(--border)" }}
              >
                lock
              </button>
            </form>
            <SignOutButton />
          </div>
        </div>
      </nav>

      <section className="max-w-5xl mx-auto px-6 py-12">
        <p className="font-mono lowercase text-xs text-text-faint">waitlist</p>
        <h1 className="font-sans text-2xl text-text-primary mt-2 lowercase">pending users</h1>

        {error && <p className="font-mono text-xs text-red-400 lowercase mt-6">{error.message}</p>}

        <div className="mt-8 space-y-3">
          {pending && pending.length > 0 ? (
            pending.map((p) => (
              <div
                key={p.id}
                className="bg-card border border-border p-5 flex items-start justify-between gap-6"
              >
                <div className="min-w-0">
                  <p className="text-text-primary text-sm">{p.full_name}</p>
                  <p className="font-mono text-xs text-text-faint mt-1 lowercase">{p.email}</p>
                  <p className="text-text-muted text-sm mt-3 truncate">{p.what_they_are_building}</p>
                  <p className="font-mono lowercase text-xs text-text-faint mt-2">stage: {p.stage}</p>
                </div>
                <ApproveButton id={p.id} />
              </div>
            ))
          ) : (
            <p className="font-mono lowercase text-xs text-text-faint">no pending users.</p>
          )}
        </div>

        <div className="mt-16">
          <p className="font-mono lowercase text-xs text-text-faint">tier_management</p>
          <h2 className="font-sans text-2xl text-text-primary mt-2 lowercase">approved users</h2>

          <div className="mt-8 space-y-3">
            {approved && approved.length > 0 ? (
              approved.map((p) => (
                <div
                  key={p.id}
                  className="bg-card border border-border p-5 flex items-start justify-between gap-6"
                >
                  <div className="min-w-0">
                    <p className="text-text-primary text-sm">{p.full_name ?? "—"}</p>
                    <p className="font-mono text-xs text-text-faint mt-1 lowercase">{p.email}</p>
                    {p.username && (
                      <p className="font-mono text-[0.65rem] text-text-faint mt-1 lowercase">
                        @{p.username}
                      </p>
                    )}
                  </div>
                  <TierSelect id={p.id} currentTier={p.tier ?? "free"} />
                </div>
              ))
            ) : (
              <p className="font-mono lowercase text-xs text-text-faint">no approved users.</p>
            )}
          </div>
        </div>

        <div className="mt-16">
          <p className="font-mono lowercase text-xs text-text-faint">vault_nominations</p>
          <h2 className="font-sans text-2xl text-text-primary mt-2 lowercase">pending nominations</h2>

          <div className="mt-8 space-y-3">
            {vaultNoms && vaultNoms.length > 0 ? (
              vaultNoms.map((n) => {
                const post: any = nomPostMap.get(n.post_id);
                const nominator: any = n.nominated_by ? nomProfileMap.get(n.nominated_by) : null;
                const author: any = post?.author_id ? nomProfileMap.get(post.author_id) : null;
                return (
                  <div
                    key={n.id}
                    className="bg-card border border-border p-5 flex items-start justify-between gap-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-2">
                        original post · {post?.is_anonymous
                          ? "anonymous"
                          : author?.full_name?.toLowerCase() ?? "—"}
                        {post?.tag ? ` · ${post.tag}` : ""}
                      </p>
                      <p className="text-text-secondary text-sm whitespace-pre-wrap">
                        {post?.content ?? "(post deleted)"}
                      </p>
                      <p className="font-mono lowercase text-[0.65rem] text-text-faint mt-4">
                        nominated by {nominator?.full_name?.toLowerCase() ?? "—"}
                      </p>
                      <p className="text-text-muted text-[0.85rem] mt-1 italic">
                        “{n.reason ?? ""}”
                      </p>
                    </div>
                    <VaultNominationActions id={n.id} />
                  </div>
                );
              })
            ) : (
              <p className="font-mono lowercase text-xs text-text-faint">no pending nominations.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
