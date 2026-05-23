import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

export async function GET(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const admin = createAdminClient();

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86_400_000).toISOString();
  const eightWeeksAgo = new Date(now - 8 * 7 * 86_400_000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000).toISOString();

  // active users this week (from sessions)
  const { data: sess } = await admin
    .from("sessions")
    .select("user_id")
    .gte("created_at", sevenDaysAgo);
  const activeWeek = new Set((sess ?? []).map((s: any) => s.user_id));

  // posts this week
  const { count: postsWeek } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);

  // check-ins this week, who completed
  const { data: checkinsWeek } = await admin
    .from("check_ins")
    .select("user_id, created_at")
    .gte("created_at", sevenDaysAgo);
  const checkedInUsers = new Set((checkinsWeek ?? []).map((c: any) => c.user_id));

  // most active cohort by post count this week
  // (compute by joining posts → cohort_members)
  const { data: postsThisWeek } = await admin
    .from("posts")
    .select("author_id")
    .gte("created_at", sevenDaysAgo);
  const authorPostCount = new Map<string, number>();
  (postsThisWeek ?? []).forEach((p: any) => {
    if (!p.author_id) return;
    authorPostCount.set(p.author_id, (authorPostCount.get(p.author_id) ?? 0) + 1);
  });
  const { data: members } = await admin.from("cohort_members").select("cohort_id, user_id");
  const cohortScore = new Map<string, number>();
  (members ?? []).forEach((m: any) => {
    const c = authorPostCount.get(m.user_id) ?? 0;
    if (!c) return;
    cohortScore.set(m.cohort_id, (cohortScore.get(m.cohort_id) ?? 0) + c);
  });
  let topCohortId: string | null = null;
  let topCohortScore = 0;
  cohortScore.forEach((v, k) => {
    if (v > topCohortScore) {
      topCohortScore = v;
      topCohortId = k;
    }
  });
  let topCohortName: string | null = null;
  if (topCohortId) {
    const { data: c } = await admin.from("cohorts").select("name").eq("id", topCohortId).single();
    topCohortName = c?.name ?? null;
  }

  // vault saves this week
  const { count: vaultSaves } = await admin
    .from("saved_items")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);

  // collab board activity this week
  const { count: projectsWeek } = await admin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);
  const { count: votesWeek } = await admin
    .from("decision_votes")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);

  // referral conversion (best-effort) — invites used vs created
  let referralConversion = 0;
  try {
    const { count: invitesTotal } = await admin
      .from("cohort_invites")
      .select("id", { count: "exact", head: true });
    const { count: invitesUsed } = await admin
      .from("cohort_invites")
      .select("id", { count: "exact", head: true })
      .not("used_by", "is", null);
    if (invitesTotal && invitesTotal > 0) {
      referralConversion = Math.round(((invitesUsed ?? 0) / invitesTotal) * 100);
    }
  } catch {}

  const avgPostsPerUser =
    activeWeek.size > 0 ? Number(((postsWeek ?? 0) / activeWeek.size).toFixed(2)) : 0;
  const checkinCompletion =
    activeWeek.size > 0 ? Math.round((checkedInUsers.size / activeWeek.size) * 100) : 0;

  // retention table — last 8 weeks
  const weeks: any[] = [];
  for (let i = 0; i < 8; i++) {
    const end = new Date(now - i * 7 * 86_400_000);
    const start = new Date(end.getTime() - 7 * 86_400_000);
    const [signups, posts, checkins, sessRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString()),
      admin
        .from("posts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString()),
      admin
        .from("check_ins")
        .select("id", { count: "exact", head: true })
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString()),
      admin
        .from("sessions")
        .select("user_id")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString()),
    ]);
    const activeCount = new Set((sessRes.data ?? []).map((s: any) => s.user_id)).size;
    weeks.push({
      week_start: start.toISOString().slice(0, 10),
      signups: signups.count ?? 0,
      active: activeCount,
      posts: posts.count ?? 0,
      checkins: checkins.count ?? 0,
    });
  }

  // tag popularity — last 30 days
  const { data: tagPosts } = await admin
    .from("posts")
    .select("tag")
    .gte("created_at", thirtyDaysAgo);
  const tagCounts = new Map<string, number>();
  (tagPosts ?? []).forEach((p: any) => {
    if (!p.tag) return;
    tagCounts.set(p.tag, (tagCounts.get(p.tag) ?? 0) + 1);
  });
  const tagPopularity = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    avgPostsPerUser,
    checkinCompletion,
    mostActiveCohort: topCohortName ?? "—",
    vaultSavesWeek: vaultSaves ?? 0,
    collabActivity: { projects: projectsWeek ?? 0, votes: votesWeek ?? 0 },
    referralConversion,
    weeks: weeks.reverse(),
    tagPopularity,
  });
}
