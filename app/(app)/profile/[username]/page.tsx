import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import Avatar from "@/components/Avatar";
import NoGrid from "@/components/ui/NoGrid";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";
import { TabPill, TabPillRow } from "@/components/ui/TabPill";
import StagePill from "@/components/cohort/StagePill";
import TierPill from "@/components/TierPill";
import ProfileBilling from "@/components/ProfileBilling";
import ProfilePostsList from "@/components/ProfilePostsList";
import HandshakeButton from "@/components/HandshakeButton";
import CohortFingerprint, { FINGERPRINT_TYPES } from "@/components/CohortFingerprint";
import VouchedBadge from "@/components/VouchedBadge";
import VouchButton from "@/components/VouchButton";
import AdvanceStageButton from "@/components/AdvanceStageButton";
import SkillsEditor from "@/components/collab/SkillsEditor";
import { parseDbTime } from "@/lib/stage";
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

// A date-only value ("2026-09-13", e.g. handshakes.date) is read as that local
// day; new Date() would take it as UTC midnight and show the day before in the
// Americas. Timestamps can arrive zoneless, so they go through parseDbTime.
function formatDay(ts: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ts);
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : parseDbTime(ts);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sentence(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const BODY: React.CSSProperties = { fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)" };

export default async function ProfilePage(
  props: {
    params: Promise<{ username: string }>;
    searchParams: Promise<{ tab?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const supabase = await createClient();
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
  // Only the owner sees their own tier when it's "free"; other viewers see
  // member/partner labels only.
  const canSeeTier = isOwner;
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

  // Projects — owned + joined. Newer projects store `title`; older ones `name`.
  const { data: ownedProjects } = await supabase
    .from("projects")
    .select("id, title, name, description, status, created_at")
    .eq("owner_id", profile.id);

  const { data: joinedRows } = await supabase
    .from("project_members")
    .select("projects(id, title, name, description, status, created_at, owner_id)")
    .eq("user_id", profile.id);

  const joinedProjects = (joinedRows ?? [])
    .map((r: any) => r.projects)
    .filter((p: any) => p && p.owner_id !== profile.id);

  const projects = [...(ownedProjects ?? []), ...joinedProjects] as {
    id: string;
    title: string | null;
    name: string | null;
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

  const hasMirror = !!(responseMirror && responseMirror.total > 0) || !!mostActive || longestStreak > 0 || !!favoriteTag;

  return (
    <>
      <NoGrid />
      <TopBar sleek title="profile" tier={myTier.toUpperCase()} userId={user.id} />
      <section
        className={`page-pad ${ui.pageGlow}`}
        style={{ padding: "28px 32px 40px", maxWidth: 1080, margin: "0 auto" }}
      >
        {/* Header */}
        <div className={ui.tile} style={{ padding: 24 }}>
          <div className="flex items-start gap-5">
            <Avatar
              name={profile.full_name}
              stage={profile.stage}
              size={76}
              depthRing={depthRing}
              anniversary={anniversary}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <h1
                    className={`${ui.titleGradient} ${ui.balance}`}
                    style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}
                  >
                    {profile.full_name ?? "—"}
                  </h1>
                  <p className="truncate" style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                    @{profile.username}
                  </p>
                </div>
                {isOwner ? (
                  <Link href="/settings" data-tour-id="profile-edit" className={`${ui.tileLink} shrink-0`}>
                    Settings →
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <VouchButton vouchedForId={profile.id} alreadyVouched={!!myVouchExists} />
                    <HandshakeButton
                      sleek
                      currentUserId={user.id}
                      recipientId={profile.id}
                      recipientName={profile.full_name}
                    />
                    <Link href={`/messages?to=${profile.id}`} className={ui.primaryBtn}>
                      Message
                    </Link>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 14 }}>
                <StagePill sleek stage={profile.stage} />
                {isOwner && <AdvanceStageButton currentStage={profile.stage} />}
                {/* Owners see their tier (incl. free); other viewers only see
                    member/partner — free adds nothing as a label on someone
                    else's profile. */}
                {(canSeeTier ||
                  profile.tier === "member" ||
                  profile.tier === "partner") && <TierPill sleek tier={profile.tier} />}
                {handshakeCount > 0 && (
                  <span className={ui.chip}>
                    {handshakeCount} {handshakeCount === 1 ? "handshake" : "handshakes"}
                  </span>
                )}
                {vouchers.length > 0 && <VouchedBadge vouchers={vouchers} />}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ margin: "22px 0 18px" }}>
          <TabPillRow>
            <TabPill sleek active={tab === "about"} href={`/profile/${profile.username}`}>
              About
            </TabPill>
            <TabPill sleek active={tab === "posts"} href={`/profile/${profile.username}?tab=posts`}>
              Posts
            </TabPill>
            <TabPill sleek active={tab === "handshakes"} href={`/profile/${profile.username}?tab=handshakes`}>
              Handshakes
              {handshakes.length > 0 && (
                <span style={{ color: "#f8c56a", marginLeft: 6 }}>{handshakes.length}</span>
              )}
            </TabPill>
          </TabPillRow>
        </div>

        {tab === "about" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Tile kicker="Building">
                <p style={BODY}>{profile.what_they_are_building ?? "—"}</p>
              </Tile>
              <Tile kicker="Trust score">
                <p style={{ fontSize: 24, fontWeight: 600, color: "#f8c56a", lineHeight: 1.1 }}>
                  {profile.trust_score ?? 0}
                </p>
              </Tile>
              <Tile kicker="Joined">
                <p style={{ fontSize: 15, color: "var(--text-primary)" }}>{formatDay(profile.created_at)}</p>
              </Tile>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start" style={{ marginTop: 16 }}>
              <div className="space-y-4 min-w-0">
                {/* Cohort fingerprint — a shape from the mix of post types */}
                <Tile kicker={isOwner ? "Your cohort fingerprint" : "Cohort fingerprint"}>
                  <div className="flex items-center gap-5 flex-wrap">
                    <div className="shrink-0">
                      <CohortFingerprint fp={fingerprint} size={128} />
                    </div>
                    <div className="min-w-0" style={{ flex: "1 1 160px" }}>
                      <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                        A shape from how {isOwner ? "you show" : "they show"} up in the room.
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5" style={{ marginTop: 10 }}>
                        {FINGERPRINT_TYPES.map((t) => (
                          <span key={t.key} className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: t.color }} />
                            {sentence(t.key)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Tile>

                {/* Skills */}
                <div data-tour-id="profile-skills">
                  <Tile kicker="Skills">
                    {isOwner ? (
                      <SkillsEditor userId={profile.id} skills={skills} />
                    ) : skills.length === 0 ? (
                      <p className={ui.emptySub} style={{ marginTop: 0 }}>No skills listed.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {skills.map((s) => (
                          <span key={s} className={`${ui.chip} ${ui.chipAmber}`}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </Tile>
                </div>

                {/* Project contributions */}
                <Tile kicker="Contributions" right={projects.length > 0 ? `${projects.length}` : undefined}>
                  {projects.length === 0 ? (
                    <p className={ui.emptySub} style={{ marginTop: 0 }}>No project contributions yet.</p>
                  ) : (
                    <div className="space-y-1" style={{ margin: "0 -10px" }}>
                      {projects.map((p) => {
                        const title = p.title || p.name || "Untitled project";
                        const status = p.status ?? "open";
                        const inner = (
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate" style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                                {title}
                              </p>
                              {p.description && (
                                <p className="line-clamp-2" style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)", marginTop: 2 }}>
                                  {p.description}
                                </p>
                              )}
                            </div>
                            <span
                              className={`${ui.chip} ${status === "open" ? ui.chipAmber : ""} shrink-0`}
                              style={
                                status === "completed"
                                  ? { color: "#4ade80", borderColor: "rgba(34, 197, 94, 0.35)" }
                                  : undefined
                              }
                            >
                              {sentence(status)}
                            </span>
                          </div>
                        );
                        // Only members can open a project room; on your own profile
                        // every listed project is one you belong to.
                        return isOwner ? (
                          <Link key={p.id} href={`/collab/${p.id}`} className={`block ${ui.row}`} style={{ padding: 10 }}>
                            {inner}
                          </Link>
                        ) : (
                          <div key={p.id} className={ui.row} style={{ padding: 10 }}>
                            {inner}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Tile>
              </div>

              <div className="space-y-4 min-w-0">
                {/* Private mirror — owner only */}
                {isOwner && (
                  <Tile kicker="Mirror" right="Only you see this">
                    <div className="space-y-2">
                      {responseMirror && responseMirror.total > 0 && (
                        <p style={BODY}>
                          {responseMirror.returned} of the last {responseMirror.total} people you helped came
                          back to update you.
                        </p>
                      )}
                      {mostActive && <p style={BODY}>{sentence(mostActive)}</p>}
                      {longestStreak > 0 && (
                        <p style={BODY}>
                          Your longest streak was {longestStreak} {longestStreak === 1 ? "week" : "weeks"}.
                        </p>
                      )}
                      {favoriteTag && (
                        <p style={{ ...BODY, color: "#f8c56a" }}>You keep coming back to {favoriteTag}.</p>
                      )}
                      {!hasMirror && (
                        <p className={ui.emptySub} style={{ marginTop: 0 }}>
                          More will appear as you post and check in.
                        </p>
                      )}
                    </div>
                  </Tile>
                )}

                {/* Cohorts */}
                <Tile kicker="Cohorts">
                  {cohorts.length === 0 ? (
                    <p className={ui.emptySub} style={{ marginTop: 0 }}>Not in a cohort yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {cohorts.map((c) =>
                        // A cohort room is members-only, so only your own
                        // cohorts link through.
                        isOwner ? (
                          <Link key={c.id} href={`/cohort/${c.id}`} className={`${ui.chip} hover:text-text-primary`}>
                            {c.name}
                          </Link>
                        ) : (
                          <span key={c.id} className={ui.chip}>
                            {c.name}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </Tile>

                {/* Billing — own profile only */}
                {isOwner && <ProfileBilling />}
              </div>
            </div>
          </>
        ) : tab === "posts" ? (
          <div className="space-y-3" style={{ maxWidth: 760 }}>
            <ProfilePostsList posts={posts as any} />
          </div>
        ) : handshakes.length === 0 ? (
          <div className={ui.tile} style={{ padding: "20px 22px", maxWidth: 760 }}>
            <div className={ui.empty}>
              <p className={ui.emptyTitle}>
                {isOwner ? "No handshakes logged yet." : "No handshakes between you yet."}
              </p>
              <p className={ui.emptySub}>
                Log agreements with founders you trust, from their profile or a project room.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3" style={{ maxWidth: 760 }}>
            {handshakes.map((h: any) => {
              const otherId = h.initiator_id === profile.id ? h.recipient_id : h.initiator_id;
              const other = otherById.get(otherId) as any;
              const projectName = h.project_id ? projectNameById.get(h.project_id) : null;
              const name = other?.full_name ?? "—";
              return (
                <div key={h.id} className={`${ui.tile} flex items-start gap-3`} style={{ padding: "14px 16px" }}>
                  <Avatar name={other?.full_name} stage={other?.stage} username={other?.username} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {other?.username ? (
                        <Link
                          href={`/profile/${other.username}`}
                          className="truncate hover:underline"
                          style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}
                        >
                          {name}
                        </Link>
                      ) : (
                        <p className="truncate" style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                          {name}
                        </p>
                      )}
                      {projectName && <span className={ui.chip}>In {String(projectName)}</span>}
                      <span className="ml-auto shrink-0" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {formatDay(h.date)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap" style={{ ...BODY, marginTop: 6 }}>
                      {h.agreement}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
