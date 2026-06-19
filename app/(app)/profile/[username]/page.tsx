import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUnlocked } from "@/app/admin/session";
import TopBar from "@/components/TopBar";
import Avatar from "@/components/Avatar";
import StagePill from "@/components/cohort/StagePill";
import TierPill from "@/components/TierPill";
import ProfileBilling from "@/components/ProfileBilling";
import ProfilePostsList from "@/components/ProfilePostsList";
import HandshakeButton from "@/components/HandshakeButton";
import CohortFingerprint from "@/components/CohortFingerprint";
import VouchedBadge from "@/components/VouchedBadge";
import VouchButton from "@/components/VouchButton";
import AdvanceStageButton from "@/components/AdvanceStageButton";
import SkillsEditor from "@/components/collab/SkillsEditor";
import {
  getCohortFingerprint,
  getFavoriteTag,
  getHandshakeCount,
  getLongestStreak,
  getMostActiveTime,
  getResponseRateMirror,
  getVouchers,
  hasDepthRing,
  isAnniversary,
  postsMovedTheRoomBatch,
} from "@/lib/recognition";

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

  // Try selecting with skills; fall back to the base columns if the skills
  // column doesn't exist yet (migration not run). This keeps profiles loading
  // regardless of DB state.
  let profile: any = null;
  {
    const withSkills = await supabase
      .from("profiles")
      .select("id, username, full_name, stage, what_they_are_building, trust_score, tier, created_at, skills")
      .eq("username", params.username)
      .single();
    if (withSkills.data) {
      profile = withSkills.data;
    } else {
      const base = await supabase
        .from("profiles")
        .select("id, username, full_name, stage, what_they_are_building, trust_score, tier, created_at")
        .eq("username", params.username)
        .single();
      profile = base.data ? { ...base.data, skills: [] } : null;
    }
  }

  if (!profile) notFound();

  const isOwner = profile.id === user.id;
  const isAdmin = isAdminUnlocked();
  const canSeeTier = isOwner || isAdmin;
  const tab =
    searchParams.tab === "posts"
      ? "posts"
      : searchParams.tab === "handshakes"
        ? "handshakes"
        : "about";

  // Recognition flags for this profile
  const [
    depthRing,
    handshakeCount,
    vouchers,
    fingerprint,
    myVouchExists,
  ] = await Promise.all([
    hasDepthRing(supabase, profile.id),
    getHandshakeCount(supabase, profile.id),
    getVouchers(supabase, profile.id),
    getCohortFingerprint(supabase, profile.id),
    isOwner
      ? Promise.resolve(false)
      : supabase
          .from("vouches")
          .select("id", { count: "exact", head: true })
          .eq("voucher_id", user.id)
          .eq("vouched_for_id", profile.id)
          .then((r) => (r.count ?? 0) > 0),
  ]);
  const anniversary = isAnniversary(profile.created_at);

  // Private mirror metrics (owner only)
  const [responseMirror, mostActive, longestStreak, favoriteTag] = isOwner
    ? await Promise.all([
        getResponseRateMirror(supabase, profile.id),
        getMostActiveTime(supabase, profile.id),
        getLongestStreak(supabase, profile.id),
        getFavoriteTag(supabase, profile.id),
      ])
    : [null, null, 0, null];

  // Cohort memberships
  const { data: memberships } = await supabase
    .from("cohort_members")
    .select("cohort_id, cohorts(id, name)")
    .eq("user_id", profile.id);

  const cohorts =
    (memberships ?? [])
      .map((m: any) => m.cohorts)
      .filter(Boolean) as { id: string; name: string }[];

  // Skills — canonical source is profiles.skills (text[])
  const skills = ((profile as any).skills ?? []) as string[];

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

  // Posts authored (attributed only). Wrapped defensively so a failure in this
  // tab-specific path degrades to an empty list instead of a 500.
  let posts: any[] = [];
  if (tab === "posts") {
    try {
      const { data: postsRows } = await supabase
        .from("posts")
        .select(
          "id, content, tag, is_anonymous, post_type, reply_count, created_at, local_hour",
        )
        .eq("author_id", profile.id)
        .eq("is_anonymous", false)
        .is("parent_post_id", null)
        .order("created_at", { ascending: false })
        .limit(100);

      const movedSetProfile = postsRows?.length
        ? await postsMovedTheRoomBatch(
            supabase,
            postsRows.map((p: any) => ({ id: p.id, created_at: p.created_at })),
          )
        : new Set<string>();

      posts = (postsRows ?? []).map((p: any) => ({
        ...p,
        author: {
          full_name: profile.full_name,
          stage: profile.stage,
          username: profile.username,
          created_at: profile.created_at,
        },
        movedTheRoom: movedSetProfile.has(p.id),
        authorDepthRing: depthRing,
        authorAnniversary: anniversary,
      }));
    } catch {
      posts = [];
    }
  }

  // Handshakes — RLS already restricts rows to the two parties, so the viewer
  // only ever sees handshakes they are part of. Owner sees everything involving
  // them; a viewer on someone else's profile only sees mutual ones. project_id
  // is selected defensively (the column may not exist pre-migration).
  const handshakeOr = isOwner
    ? `initiator_id.eq.${profile.id},recipient_id.eq.${profile.id}`
    : `and(initiator_id.eq.${user.id},recipient_id.eq.${profile.id}),and(initiator_id.eq.${profile.id},recipient_id.eq.${user.id})`;
  async function fetchHandshakes(cols: string) {
    return supabase
      .from("handshakes")
      .select(cols)
      .or(handshakeOr)
      .order("date", { ascending: false })
      .limit(100);
  }
  let handshakesRes = await fetchHandshakes(
    "id, initiator_id, recipient_id, agreement, date, created_at, project_id",
  );
  if (handshakesRes.error) {
    handshakesRes = await fetchHandshakes(
      "id, initiator_id, recipient_id, agreement, date, created_at",
    );
  }
  const handshakes = (handshakesRes.data ?? []) as any[];
  const otherIds = Array.from(
    new Set(
      handshakes.map((h: any) =>
        h.initiator_id === profile.id ? h.recipient_id : h.initiator_id
      )
    )
  ).filter(Boolean);

  const { data: otherProfiles } =
    otherIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, stage, username")
          .in("id", otherIds)
      : { data: [] as any[] };

  const otherById = new Map((otherProfiles ?? []).map((p: any) => [p.id, p]));

  // Project names for handshakes logged inside a project room.
  const handshakeProjectIds = Array.from(
    new Set(handshakes.map((h: any) => h.project_id).filter(Boolean))
  );
  const { data: handshakeProjects } =
    handshakeProjectIds.length > 0
      ? await supabase
          .from("projects")
          .select("id, title, name")
          .in("id", handshakeProjectIds)
      : { data: [] as any[] };
  const projectNameById = new Map(
    (handshakeProjects ?? []).map((p: any) => [p.id, p.title ?? p.name ?? null])
  );

  return (
    <>
      <TopBar title="profile" tier={myTier.toUpperCase()} userId={user.id} />
      <section className="max-w-3xl mx-auto px-6 py-10">
        {/* Header card */}
        <div
          className="p-6 border flex items-start gap-5"
          style={{ background: "var(--card-elev)", borderColor: "var(--border)" }}
        >
          <Avatar
            name={profile.full_name}
            stage={profile.stage}
            size={72}
            depthRing={depthRing}
            anniversary={anniversary}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-sans lowercase text-text-primary text-2xl">
                  {profile.full_name?.toLowerCase() ?? "—"}
                </h1>
                <p className="font-mono lowercase text-[0.7rem] text-text-faint mt-1">
                  @{profile.username}
                </p>
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <StagePill stage={profile.stage} />
                  {isOwner && <AdvanceStageButton currentStage={profile.stage} />}
                  {canSeeTier && <TierPill tier={profile.tier} />}
                  {handshakeCount > 0 && (
                    <span
                      className="font-mono text-[0.8rem]"
                      style={{ color: "#f59e0b" }}
                      aria-label={`${handshakeCount} handshakes`}
                    >
                       {handshakeCount}
                    </span>
                  )}
                  {vouchers.length > 0 && (
                    <VouchedBadge vouchers={vouchers} />
                  )}
                </div>
              </div>
              {!isOwner && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <VouchButton
                    vouchedForId={profile.id}
                    alreadyVouched={!!myVouchExists}
                  />
                  <HandshakeButton
                    currentUserId={user.id}
                    recipientId={profile.id}
                    recipientName={profile.full_name}
                  />
                  <Link
                    href={`/messages?to=${profile.id}`}
                    className="font-mono lowercase text-[0.7rem] px-3 py-2 hover:opacity-90 whitespace-nowrap"
                    style={{ background: "rgba(245, 158, 11, 0.18)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.55)", borderRadius: 5, boxShadow: "0 0 10px rgba(245, 158, 11, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.06)", fontWeight: 700, letterSpacing: "0.02em" }}
                  >
                    + message
                  </Link>
                </div>
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
          <Link
            href={`/profile/${profile.username}?tab=handshakes`}
            className="font-mono lowercase text-[0.7rem] px-3 py-2 flex items-center gap-1.5"
            style={{
              color: tab === "handshakes" ? "#f59e0b" : "var(--text-muted)",
              borderBottom: tab === "handshakes" ? "2px solid #f59e0b" : "2px solid transparent",
            }}
          >
            handshakes
            {handshakes.length > 0 && (
              <span
                className="font-mono text-[0.6rem] px-1.5 rounded-full"
                style={{
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "#f59e0b",
                }}
              >
                {handshakes.length}
              </span>
            )}
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

            {/* Cohort fingerprint — abstract shape from post type distribution */}
            <div className="bg-card border border-border p-5 mt-6 flex items-center gap-6">
              <div className="shrink-0">
                <CohortFingerprint fp={fingerprint} />
              </div>
              <div className="min-w-0">
                <p className="font-mono lowercase text-[0.65rem] text-text-faint">
                  {isOwner ? "your cohort fingerprint" : "cohort fingerprint"}
                </p>
                <p className="font-mono lowercase text-[0.7rem] text-text-muted mt-2 leading-relaxed">
                  a shape from how they show up in the room.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="font-mono lowercase text-[0.55rem]" style={{ color: "#38bdf8" }}>question</span>
                  <span className="font-mono lowercase text-[0.55rem]" style={{ color: "#6e7681" }}>update</span>
                  <span className="font-mono lowercase text-[0.55rem]" style={{ color: "#f59e0b" }}>decision</span>
                  <span className="font-mono lowercase text-[0.55rem]" style={{ color: "#22c55e" }}>win</span>
                  <span className="font-mono lowercase text-[0.55rem]" style={{ color: "#a78bfa" }}>blocker</span>
                </div>
              </div>
            </div>

            {/* Private mirror — owner only */}
            {isOwner && (
              <div className="bg-card border border-border p-5 mt-6 space-y-2.5">
                <p className="font-mono lowercase text-[0.65rem] text-text-faint mb-2">
                  mirror
                </p>
                {responseMirror && responseMirror.total > 0 && (
                  <p className="font-mono lowercase text-[0.75rem] text-text-muted">
                    {responseMirror.returned} of the last {responseMirror.total} people you helped came back to update you.
                  </p>
                )}
                {mostActive && (
                  <p className="font-mono lowercase text-[0.75rem] text-text-muted">
                    {mostActive}
                  </p>
                )}
                {longestStreak > 0 && (
                  <p className="font-mono lowercase text-[0.75rem] text-text-muted">
                    your longest streak was {longestStreak} {longestStreak === 1 ? "week" : "weeks"}.
                  </p>
                )}
                {favoriteTag && (
                  <p className="font-mono lowercase text-[0.75rem]" style={{ color: "#f59e0b" }}>
                    you keep coming back to {favoriteTag}.
                  </p>
                )}
                {!responseMirror && !mostActive && longestStreak === 0 && !favoriteTag && (
                  <p className="font-mono lowercase text-[0.7rem] text-text-faint">
                    more will appear as you post and check in.
                  </p>
                )}
              </div>
            )}

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
              {isOwner ? (
                <SkillsEditor userId={profile.id} skills={skills} />
              ) : skills.length === 0 ? (
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
                        border: "1px solid rgba(245, 158, 11,0.35)",
                        color: "#f59e0b",
                        background: "rgba(245, 158, 11,0.06)",
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

            {/* Billing — own profile only */}
            {isOwner && <ProfileBilling />}
          </>
        ) : tab === "posts" ? (
          <div className="mt-6 space-y-3">
            <ProfilePostsList posts={posts as any} />
          </div>
        ) : (
          <div className="mt-6">
            {handshakes.length === 0 ? (
              <div className="bg-card border border-border p-6">
                <p className="font-mono lowercase text-xs text-text-faint">
                  no handshakes logged yet. use ◈ to record agreements with founders you trust.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {handshakes.map((h: any) => {
                  const otherId =
                    h.initiator_id === profile.id ? h.recipient_id : h.initiator_id;
                  const other = otherById.get(otherId) as any;
                  const projectName = h.project_id ? projectNameById.get(h.project_id) : null;
                  return (
                    <div
                      key={h.id}
                      className="p-4 border flex items-start gap-3"
                      style={{
                        borderColor: "rgba(245, 158, 11,0.25)",
                        background: "var(--card-elev)",
                      }}
                    >
                      <span
                        className="font-mono text-[1rem] shrink-0 mt-0.5"
                        style={{ color: "#f59e0b" }}
                        aria-hidden
                      >
                        ◈
                      </span>
                      {other?.username ? (
                        <Link href={`/profile/${other.username}`} className="shrink-0">
                          <Avatar
                            name={other?.full_name}
                            stage={other?.stage}
                            username={other?.username}
                            size={32}
                          />
                        </Link>
                      ) : (
                        <Avatar
                          name={other?.full_name}
                          stage={other?.stage}
                          username={other?.username}
                          size={32}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {other?.username ? (
                            <Link
                              href={`/profile/${other.username}`}
                              className="font-mono lowercase text-[0.75rem] text-text-primary truncate hover:text-amber transition-colors"
                            >
                              {other?.full_name?.toLowerCase() ?? "—"}
                            </Link>
                          ) : (
                            <p className="font-mono lowercase text-[0.75rem] text-text-primary truncate">
                              {other?.full_name?.toLowerCase() ?? "—"}
                            </p>
                          )}
                          {projectName && (
                            <span
                              className="font-mono lowercase text-[0.55rem] px-1.5 py-0.5"
                              style={{
                                border: "1px solid rgba(88, 166, 255, 0.4)",
                                color: "#58a6ff",
                              }}
                            >
                              in project: {String(projectName).toLowerCase()}
                            </span>
                          )}
                          <span className="font-mono lowercase text-[0.6rem] text-text-faint ml-auto shrink-0">
                            {formatDate(h.date)}
                          </span>
                        </div>
                        <p className="text-text-secondary text-[0.85rem] mt-2 leading-snug whitespace-pre-wrap">
                          {h.agreement}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
