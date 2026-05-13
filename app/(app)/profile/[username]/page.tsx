import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUnlocked } from "@/app/admin/session";
import TopBar from "@/components/TopBar";
import Avatar from "@/components/Avatar";
import StagePill from "@/components/cohort/StagePill";
import TierPill from "@/components/TierPill";
import PostCard from "@/components/PostCard";

export const dynamic = "force-dynamic";

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { tab?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me } = await supabase.from("profiles").select("tier").eq("id", user.id).single();
  const myTier = (me?.tier ?? "free") as string;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, stage, what_they_are_building, trust_score, tier, created_at")
    .eq("username", params.username)
    .single();

  if (!profile) notFound();

  const isOwner = profile.id === user.id;
  const isAdmin = isAdminUnlocked();
  const canSeeTier = isOwner || isAdmin;
  const tab = searchParams.tab === "posts" ? "posts" : "about";

  // Cohort memberships
  const { data: memberships } = await supabase
    .from("cohort_members")
    .select("cohort_id, cohorts(id, name)")
    .eq("user_id", profile.id);

  const cohorts =
    (memberships ?? [])
      .map((m: any) => m.cohorts)
      .filter(Boolean) as { id: string; name: string }[];

  // Skills
  const { data: skillsRows } = await supabase
    .from("user_skills")
    .select("skill")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: true });
  const skills = (skillsRows ?? []).map((s: any) => s.skill as string);

  // Projects — owned + joined
  const { data: ownedProjects } = await supabase
    .from("projects")
    .select("id, name, description, status, created_at")
    .eq("owner_id", profile.id);

  const { data: joinedRows } = await supabase
    .from("project_members")
    .select("projects(id, name, description, status, created_at, owner_id)")
    .eq("user_id", profile.id);

  const joinedProjects = (joinedRows ?? [])
    .map((r: any) => r.projects)
    .filter((p: any) => p && p.owner_id !== profile.id);

  const projects = [...(ownedProjects ?? []), ...joinedProjects] as {
    id: string;
    name: string;
    description: string | null;
    status: string | null;
    created_at: string;
  }[];

  // Posts authored (attributed only)
  const { data: postsRows } =
    tab === "posts"
      ? await supabase
          .from("posts")
          .select("id, content, tag, is_anonymous, post_type, reply_count, created_at")
          .eq("author_id", profile.id)
          .eq("is_anonymous", false)
          .order("created_at", { ascending: false })
          .limit(100)
      : { data: null as any };

  const posts = (postsRows ?? []).map((p: any) => ({
    ...p,
    author: { full_name: profile.full_name, stage: profile.stage, username: profile.username },
  }));

  return (
    <>
      <TopBar title="profile" tier={myTier.toUpperCase()} userId={user.id} />
      <section className="max-w-3xl mx-auto px-6 py-10">
        {/* Header card */}
        <div
          className="p-6 border flex items-start gap-5"
          style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        >
          <Avatar name={profile.full_name} stage={profile.stage} size={72} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-sans lowercase text-text-primary text-2xl">
                  {profile.full_name?.toLowerCase() ?? "—"}
                </h1>
                <p className="font-mono lowercase text-[0.7rem] text-text-faint mt-1">
                  @{profile.username}
                </p>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <StagePill stage={profile.stage} />
                  {canSeeTier && <TierPill tier={profile.tier} />}
                </div>
              </div>
              {!isOwner && (
                <Link
                  href={`/cohort?dm=${profile.id}`}
                  className="font-mono lowercase text-[0.7rem] px-3 py-2 bg-amber text-bg hover:opacity-90 whitespace-nowrap"
                  style={{ background: "#f59e0b", color: "#000" }}
                >
                  + message
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="mt-6 flex items-center gap-1 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <Link
            href={`/profile/${profile.username}`}
            className="font-mono lowercase text-[0.7rem] px-3 py-2"
            style={{
              color: tab === "about" ? "#f59e0b" : "var(--text-muted)",
              borderBottom: tab === "about" ? "2px solid #f59e0b" : "2px solid transparent",
            }}
          >
            about
          </Link>
          <Link
            href={`/profile/${profile.username}?tab=posts`}
            className="font-mono lowercase text-[0.7rem] px-3 py-2"
            style={{
              color: tab === "posts" ? "#f59e0b" : "var(--text-muted)",
              borderBottom: tab === "posts" ? "2px solid #f59e0b" : "2px solid transparent",
            }}
          >
            posts
          </Link>
        </div>

        {tab === "about" ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-card border border-border p-5">
                <p className="font-mono lowercase text-[0.65rem] text-text-faint">building</p>
                <p className="text-text-secondary text-sm mt-2">
                  {profile.what_they_are_building ?? "—"}
                </p>
              </div>
              <div className="bg-card border border-border p-5">
                <p className="font-mono lowercase text-[0.65rem] text-text-faint">trust_score</p>
                <p className="font-mono text-amber text-sm mt-2">{profile.trust_score ?? 0}</p>
              </div>
              <div className="bg-card border border-border p-5">
                <p className="font-mono lowercase text-[0.65rem] text-text-faint">joined</p>
                <p className="font-mono lowercase text-text-secondary text-sm mt-2">
                  {formatDate(profile.created_at)}
                </p>
              </div>
            </div>

            {/* Cohorts */}
            <div className="bg-card border border-border p-5 mt-6">
              <p className="font-mono lowercase text-[0.65rem] text-text-faint">cohorts</p>
              {cohorts.length === 0 ? (
                <p className="font-mono lowercase text-xs text-text-faint mt-3">
                  not in a cohort yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-3">
                  {cohorts.map((c) => (
                    <Link
                      key={c.id}
                      href={`/cohort?id=${c.id}`}
                      className="font-mono lowercase text-[0.7rem] px-2.5 py-1.5 border hover:border-amber transition-colors"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      # {c.name.toLowerCase()}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Skills */}
            <div className="bg-card border border-border p-5 mt-6">
              <p className="font-mono lowercase text-[0.65rem] text-text-faint">skills</p>
              {skills.length === 0 ? (
                <p className="font-mono lowercase text-xs text-text-faint mt-3">
                  no skills listed.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-3">
                  {skills.map((s) => (
                    <span
                      key={s}
                      className="font-mono lowercase text-[0.7rem] px-2.5 py-1"
                      style={{
                        border: "1px solid rgba(245,158,11,0.35)",
                        color: "#f59e0b",
                        background: "rgba(245,158,11,0.06)",
                      }}
                    >
                      {s.toLowerCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Project contributions */}
            <div className="bg-card border border-border p-5 mt-6">
              <p className="font-mono lowercase text-[0.65rem] text-text-faint">contributions</p>
              {projects.length === 0 ? (
                <p className="font-mono lowercase text-xs text-text-faint mt-3">
                  no project contributions yet.
                </p>
              ) : (
                <div className="space-y-3 mt-3">
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 border flex items-start justify-between gap-4"
                      style={{ borderColor: "var(--border)", background: "var(--card-elev)" }}
                    >
                      <div className="min-w-0">
                        <p className="text-text-primary text-sm lowercase">
                          {p.name.toLowerCase()}
                        </p>
                        {p.description && (
                          <p className="text-text-muted text-xs mt-1">{p.description}</p>
                        )}
                      </div>
                      <span
                        className="font-mono lowercase text-[0.6rem] px-2 py-0.5 border whitespace-nowrap"
                        style={{
                          color: p.status === "completed" ? "#22c55e" : "#f59e0b",
                          borderColor:
                            p.status === "completed" ? "#22c55e" : "#f59e0b",
                        }}
                      >
                        {p.status ?? "active"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mt-6 space-y-3">
            {posts.length === 0 ? (
              <p className="font-mono lowercase text-xs text-text-faint">no posts yet.</p>
            ) : (
              posts.map((p: any) => (
                <Link
                  key={p.id}
                  href={`/${p.post_type === "pulse" ? "pulse" : "home"}#post-${p.id}`}
                  className="block hover:opacity-90 transition-opacity"
                >
                  <PostCard post={p} />
                </Link>
              ))
            )}
          </div>
        )}
      </section>
    </>
  );
}
