import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import UpgradeToast from "@/components/UpgradeToast";
import Tile from "@/components/ui/Tile";
import PersonAvatar from "@/components/ui/PersonAvatar";
import NetworkGraph from "@/components/ui/NetworkGraph";
import NoGrid from "@/components/ui/NoGrid";
import HomeCheckinHero from "@/components/home/HomeCheckinHero";
import ui from "@/components/ui/sleek.module.css";
import { STAGE_COLOR, timeAgo } from "@/lib/stage";

export const dynamic = "force-dynamic";

const COHORT_MAX = 12;
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Loose skill overlap — tokenizes free-text `looking_for` and array `skills`
// into a comparable lowercase set.
function tokens(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  if (typeof v === "string")
    return v
      .split(/[,/;]|\band\b/i)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  return [];
}
function overlaps(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const set = new Set(b);
  return a.some((t) => set.has(t) || [...set].some((x) => x.includes(t) || t.includes(x)));
}

type Member = {
  id: string;
  full_name: string | null;
  stage: string | null;
  username: string | null;
  created_at?: string | null;
  skills?: unknown;
};

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Profile (skills column is tolerated — may not exist on older schemas).
  let profile: any = null;
  {
    const withSkills = await supabase
      .from("profiles")
      .select("id, full_name, stage, tier, trust_score, username, skills")
      .eq("id", user.id)
      .single();
    profile = withSkills.error
      ? (
          await supabase
            .from("profiles")
            .select("id, full_name, stage, tier, trust_score, username")
            .eq("id", user.id)
            .single()
        ).data
      : withSkills.data;
  }

  const firstName = (profile?.full_name ?? "there").split(/\s+/)[0];
  const mySkills = tokens(profile?.skills);

  // Approved members (with skills, tolerant).
  let members: Member[] = [];
  {
    const res = await supabase
      .from("profiles")
      .select("id, full_name, stage, username, created_at, skills")
      .eq("status", "approved")
      .order("created_at", { ascending: true });
    if (res.error) {
      const base = await supabase
        .from("profiles")
        .select("id, full_name, stage, username, created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: true });
      members = (base.data ?? []) as Member[];
    } else {
      members = (res.data ?? []) as Member[];
    }
  }
  const otherMembers = members.filter((m) => m.id !== user.id);

  // Cohort fill — averaged across the cohorts the user belongs to.
  let cohortFill = 0;
  try {
    const { data: myCohortRows } = await supabase
      .from("cohort_members")
      .select("cohort_id")
      .eq("user_id", user.id);
    const myCohortIds = Array.from(
      new Set((myCohortRows ?? []).map((r: any) => r.cohort_id).filter(Boolean)),
    ) as string[];
    if (myCohortIds.length > 0) {
      const { data: rows } = await supabase
        .from("cohort_members")
        .select("cohort_id, user_id")
        .in("cohort_id", myCohortIds);
      const per = new Map<string, Set<string>>();
      for (const r of rows ?? []) {
        if (!r.cohort_id || !r.user_id) continue;
        if (!per.has(r.cohort_id)) per.set(r.cohort_id, new Set());
        per.get(r.cohort_id)!.add(r.user_id);
      }
      const sizes = myCohortIds.map((id) => per.get(id)?.size ?? 0);
      cohortFill = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
    }
  } catch {}

  // Unread DMs.
  let unreadMessages = 0;
  try {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("read", false);
    unreadMessages = count ?? 0;
  } catch {}

  // My projects & needs.
  let myProjects: any[] = [];
  let myNeeds: any[] = [];
  try {
    const { data } = await supabase
      .from("projects")
      .select("id, owner_id, title, name, category, post_type, looking_for, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    myProjects = (data ?? []).filter((p: any) => (p.post_type ?? "project") === "project");
    myNeeds = (data ?? []).filter((p: any) => p.post_type === "need");
  } catch {}

  // Applicants to my projects (pending join requests) + applications to my needs.
  const applicantsByProject = new Map<string, number>();
  try {
    const projIds = myProjects.map((p) => p.id);
    if (projIds.length > 0) {
      const { data } = await supabase
        .from("join_requests")
        .select("project_id")
        .eq("status", "pending")
        .in("project_id", projIds);
      for (const r of data ?? [])
        applicantsByProject.set((r as any).project_id, (applicantsByProject.get((r as any).project_id) ?? 0) + 1);
    }
    const needIds = myNeeds.map((n) => n.id);
    if (needIds.length > 0) {
      const { data } = await supabase
        .from("need_applications")
        .select("need_id")
        .in("need_id", needIds);
      for (const r of data ?? [])
        applicantsByProject.set((r as any).need_id, (applicantsByProject.get((r as any).need_id) ?? 0) + 1);
    }
  } catch {}
  // Name the project with the most applicants for the NEEDS YOU row.
  let topApplicantProject: { id: string; title: string; count: number } | null = null;
  for (const p of [...myProjects, ...myNeeds]) {
    const c = applicantsByProject.get(p.id) ?? 0;
    if (c > 0 && (!topApplicantProject || c > topApplicantProject.count))
      topApplicantProject = { id: p.id, title: (p.title ?? p.name ?? "a post") as string, count: c };
  }

  // A recent need from someone else that overlaps my skills.
  let matchingNeed: { author: string; id: string } | null = null;
  try {
    const { data } = await supabase
      .from("projects")
      .select("id, owner_id, looking_for, created_at")
      .eq("post_type", "need")
      .neq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    const authorById = new Map(members.map((m) => [m.id, m]));
    for (const n of data ?? []) {
      if (overlaps(tokens((n as any).looking_for), mySkills)) {
        const a = authorById.get((n as any).owner_id);
        matchingNeed = { author: (a?.full_name ?? "A founder").split(/\s+/)[0], id: (n as any).id };
        break;
      }
    }
  } catch {}

  // MATCHES YOUR NEEDS — members whose skills overlap what my needs are looking for.
  const neededSkills = Array.from(new Set(myNeeds.flatMap((n) => tokens(n.looking_for))));
  let matchPeople: Member[] = [];
  if (neededSkills.length > 0) {
    matchPeople = otherMembers.filter((m) => overlaps(tokens(m.skills), neededSkills)).slice(0, 3);
  }
  if (matchPeople.length === 0) {
    // Fallback: recent members who list any skills, so the strip is never empty.
    matchPeople = otherMembers.filter((m) => tokens(m.skills).length > 0).slice(-3).reverse();
    if (matchPeople.length === 0) matchPeople = otherMembers.slice(0, 3);
  }

  // Recent pulse posts (top-level), 2 for the preview.
  //
  // post_type must be filtered: without it this pulled the newest top-level post
  // of ANY kind, so cohort-room posts surfaced in a tile titled "recent in pulse"
  // that links to /pulse. Matches the filter /pulse itself uses, so the preview
  // and its destination can't disagree.
  let recentPosts: any[] = [];
  try {
    const { data } = await supabase
      .from("posts")
      .select("id, content, tag, post_type, reply_count, created_at, author_id")
      .eq("post_type", "pulse")
      .is("parent_post_id", null)
      .order("created_at", { ascending: false })
      .limit(2);
    const byId = new Map(members.map((m) => [m.id, m]));
    recentPosts = (data ?? []).map((p: any) => ({ ...p, author: byId.get(p.author_id) ?? null }));
  } catch {}

  const dayName = DAY[new Date().getDay()];
  // No "active now" count here: there's no presence data behind one yet, and a
  // fixed number would be a made-up stat.
  const contextLine = `${dayName} · ${members.length} member${members.length === 1 ? "" : "s"} · trust score ${profile?.trust_score ?? 0}`;

  // NEEDS YOU rows — only surface what actually needs the user.
  const needsRows: {
    key: string;
    href: string;
    tint: string;
    icon: string;
    label: React.ReactNode;
  }[] = [];
  if (unreadMessages > 0)
    needsRows.push({
      key: "msg",
      href: "/messages",
      tint: "167,139,250",
      icon: "✉",
      label: `${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`,
    });
  if (topApplicantProject)
    needsRows.push({
      key: "app",
      href: `/collab/${topApplicantProject.id}`,
      tint: "34,197,94",
      icon: "＋",
      label: (
        <>
          {topApplicantProject.count} applied to “{topApplicantProject.title}”
        </>
      ),
    });
  if (matchingNeed)
    needsRows.push({
      key: "need",
      href: "/collab?tab=needs",
      tint: "56,189,248",
      icon: "✦",
      label: `${matchingNeed.author} posted a need you can help with`,
    });

  const divider = "1px solid var(--border-default)";

  return (
    <>
      <NoGrid />
      <TopBar sleek title="home" tier={(profile?.tier ?? "free").toUpperCase()} userId={user.id} />
      <UpgradeToast />

      {/* Home is a launchpad, so it has to be readable at a glance: the column
          fills the space the chrome leaves and the rows flex into it, rather
          than running past the fold. Every list on it is already bounded (three
          rows, two posts, three projects), so nothing is hidden by this — the
          inner scrollbars are a fallback for a very short window. */}
      <div
        className={"page-pad page-fit"}
        style={{ padding: "16px 26px 18px", maxWidth: 1280, margin: "0 auto", width: "100%" }}
        data-tour-id="home-tiles"
      >
        {/* Header */}
        <div style={{ marginBottom: 12, flexShrink: 0 }}>
          <h1
            className={`${ui.titleGradient} ${ui.balance}`}
            style={{ fontSize: 23, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.15 }}
          >
            Good to see you, {firstName}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>{contextLine}</p>
        </div>

        {/* Row 1 — NEEDS YOU (wide) + check-in / cohort rail */}
        <div
          className="grid gap-4 mb-3 stack-md"
          // Basis auto + a min-content floor: the row is never shorter than what is
          // in it, so the check-in and cohort rail cannot overflow onto the strip
          // below, and it still grows to share out spare height.
          style={{ gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", flex: "1.15 1 auto", minHeight: "min-content" }}
        >
          <Tile kicker="Needs you" padding="20px 22px 10px" className="flex flex-col min-h-0">
            {needsRows.length === 0 ? (
              <div
                className="flex-1 flex flex-col items-center justify-center text-center"
                style={{ minHeight: 120, gap: 10, padding: "20px 0" }}
              >
                <span
                  aria-hidden
                  className="flex items-center justify-center"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    fontSize: 18,
                    color: "var(--green)",
                    background: "linear-gradient(135deg, rgba(34,197,94,.20), rgba(34,197,94,.05))",
                  }}
                >
                  ✓
                </span>
                <p style={{ fontSize: 14, color: "var(--text-primary)" }}>You&apos;re all caught up.</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Nothing needs you right now.</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
              {needsRows.map((r, i) => (
                <Link
                  key={r.key}
                  href={r.href}
                  className={`flex items-center gap-3 ${ui.row}`}
                  style={{
                    padding: "12px 12px",
                    margin: "0 -12px",
                    borderBottom: i < needsRows.length - 1 ? divider : "none",
                    textDecoration: "none",
                  }}
                >
                  <span
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      fontSize: 13,
                      background: `linear-gradient(135deg, rgba(${r.tint},.28), rgba(${r.tint},.06))`,
                      color: `rgb(${r.tint})`,
                    }}
                    aria-hidden
                  >
                    {r.icon}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>{r.label}</span>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>→</span>
                </Link>
              ))}
              </div>
            )}
          </Tile>

          <div className="flex flex-col gap-4 min-h-0">
            <HomeCheckinHero userId={user.id} />
            <Tile
              kicker={`Your cohort · ${cohortFill}/${COHORT_MAX}`}
              padding="18px 22px"
              // Floor chosen so the constellation still draws all five
              // members: below about this the graph scales down to its centre
              // node and the tile reads as an empty box.
              style={{ flex: "1 1 0", minHeight: 126 }}
              className="flex flex-col overflow-hidden"
            >
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <div style={{ maxWidth: 300, width: "100%", height: "100%" }}>
                  <NetworkGraph
                    you={{ full_name: profile?.full_name ?? null }}
                    members={otherMembers.slice(0, 5)}
                    fill
                  />
                </div>
              </div>
            </Tile>
          </div>
        </div>

        {/* Row 2 — MATCHES YOUR NEEDS strip */}
        <Tile padding="14px 22px" className="mb-3" style={{ flexShrink: 0 }}>
          <div className="flex items-center gap-5">
            <span className={ui.label} style={{ whiteSpace: "nowrap" }}>
              <span style={{ color: "var(--teal)", marginRight: 6 }}>✦</span>
              Matches your needs
            </span>
            <div className="flex gap-5 flex-1 min-w-0 overflow-hidden scroll-x-mobile">
              {matchPeople.map((m) => {
                const c = (m.stage && STAGE_COLOR[m.stage]) || "var(--text-muted)";
                return (
                  <Link
                    key={m.id}
                    href={m.username ? `/profile/${m.username}` : "/collab?tab=skills"}
                    className="flex items-center gap-2.5 shrink-0"
                    style={{ textDecoration: "none" }}
                  >
                    <PersonAvatar name={m.full_name} stage={m.stage} size={30} color={c} />
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      {(m.full_name ?? "founder").split(/\s+/)[0]}
                      {m.stage && (
                        <span style={{ color: "var(--text-muted)", fontSize: 11.5, marginLeft: 6 }}>
                          {m.stage}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
            <Link href="/collab?tab=skills" className={ui.tileLink} style={{ whiteSpace: "nowrap" }}>
              Browse →
            </Link>
          </div>
        </Tile>

        {/* Row 3 — RECENT IN PULSE + YOUR WORK */}
        <div
          className="grid gap-4 stack-md"
          style={{ gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", flex: "1 1 auto", minHeight: "min-content" }}
        >
          <Tile
            kicker="Recent in pulse"
            right="All posts →"
            rightHref="/pulse"
            className="flex flex-col min-h-0"
          >
            {recentPosts.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>No posts yet.</p>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
              {recentPosts.map((p, i) => {
                const replies = p.reply_count ?? 0;
                return (
                  <Link
                    key={p.id}
                    href="/pulse"
                    className="flex gap-3"
                    style={{
                      paddingBottom: i < recentPosts.length - 1 ? 14 : 0,
                      borderBottom: i < recentPosts.length - 1 ? divider : "none",
                      marginBottom: i < recentPosts.length - 1 ? 14 : 0,
                      textDecoration: "none",
                    }}
                  >
                    <PersonAvatar name={p.author?.full_name} stage={p.author?.stage} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-primary)" }}>
                        {(p.content ?? "").slice(0, 120)}
                        {(p.content ?? "").length > 120 ? "…" : ""}
                      </p>
                      <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 5 }}>
                        {p.tag === "decision" && <span style={{ color: "var(--accent)" }}>Decision · </span>}
                        {(p.author?.full_name ?? "A founder").split(/\s+/)[0]} · {timeAgo(p.created_at)} ·{" "}
                        {replies} {replies === 1 ? "reply" : "replies"}
                      </p>
                    </div>
                  </Link>
                );
              })}
              </div>
            )}
          </Tile>

          <Tile
            kicker="Your work"
            right="Board →"
            rightHref="/collab"
            className="flex flex-col min-h-0"
          >
            {myProjects.length === 0 && myNeeds.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                No projects yet.{" "}
                <Link href="/collab" className={ui.tileLink} style={{ color: "var(--text-primary)" }}>
                  Start one →
                </Link>
              </p>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
              {[...myProjects, ...myNeeds].slice(0, 3).map((p, i, arr) => {
                const applicants = applicantsByProject.get(p.id) ?? 0;
                return (
                  <Link
                    key={p.id}
                    href={`/collab/${p.id}`}
                    className="block"
                    style={{
                      paddingBottom: i < arr.length - 1 ? 12 : 0,
                      borderBottom: i < arr.length - 1 ? divider : "none",
                      marginBottom: i < arr.length - 1 ? 12 : 0,
                      textDecoration: "none",
                    }}
                  >
                    <p style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      {p.title ?? p.name ?? "Untitled"}
                    </p>
                    <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                      {applicants > 0 ? (
                        <span style={{ color: "var(--green)" }}>
                          {applicants} new applicant{applicants === 1 ? "" : "s"} ·{" "}
                        </span>
                      ) : p.category ? (
                        <span>{p.category} · </span>
                      ) : null}
                      {timeAgo(p.created_at)}
                    </p>
                  </Link>
                );
              })}
              </div>
            )}
          </Tile>
        </div>
      </div>
    </>
  );
}
