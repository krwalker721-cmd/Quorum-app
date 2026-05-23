import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

export async function GET(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const admin = createAdminClient();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const [
    totalUsersRes,
    pendingRes,
    postsWeekRes,
    signupsWeekRes,
    allProfilesRes,
    activeUsersRes,
    signupsByDayRes,
    postsByDayRes,
    checkinsByDayRes,
    recentPostsRes,
    recentSignupsRes,
    recentNomsRes,
    recentHandshakesRes,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("posts").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    admin.from("profiles").select("id, tier, status"),
    admin.from("sessions").select("user_id").gte("created_at", sevenDaysAgo),
    admin.from("profiles").select("created_at").gte("created_at", thirtyDaysAgo),
    admin.from("posts").select("created_at").gte("created_at", thirtyDaysAgo),
    admin.from("check_ins").select("created_at").gte("created_at", thirtyDaysAgo),
    admin
      .from("posts")
      .select("id, content, author_id, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("profiles")
      .select("id, full_name, username, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("vault_nominations")
      .select("id, post_id, nominated_by, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("handshakes")
      .select("id, initiator_id, recipient_id, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const tierCounts = { free: 0, tier_1: 0, tier_2: 0 };
  (allProfilesRes.data ?? []).forEach((p: any) => {
    if (p.tier && tierCounts[p.tier as keyof typeof tierCounts] !== undefined) {
      tierCounts[p.tier as keyof typeof tierCounts] += 1;
    }
  });

  const activeUserIds = new Set((activeUsersRes.data ?? []).map((s: any) => s.user_id));

  // Build a 30-day series with zeros filled in
  function buildSeries(rows: { created_at: string }[] | null) {
    const map = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86_400_000);
      const k = d.toISOString().slice(0, 10);
      map.set(k, 0);
    }
    (rows ?? []).forEach((r) => {
      const k = (r.created_at ?? "").slice(0, 10);
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
  }

  const signupsSeries = buildSeries(signupsByDayRes.data as any);
  const postsSeries = buildSeries(postsByDayRes.data as any);
  const checkinsSeries = buildSeries(checkinsByDayRes.data as any);

  // Hydrate authors for recent activity feed
  const userIds = new Set<string>();
  (recentPostsRes.data ?? []).forEach((p: any) => p.author_id && userIds.add(p.author_id));
  (recentNomsRes.data ?? []).forEach((n: any) => n.nominated_by && userIds.add(n.nominated_by));
  (recentHandshakesRes.data ?? []).forEach((h: any) => {
    if (h.initiator_id) userIds.add(h.initiator_id);
    if (h.recipient_id) userIds.add(h.recipient_id);
  });
  const profileMap = new Map<string, any>();
  if (userIds.size) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name, username")
      .in("id", Array.from(userIds));
    (profs ?? []).forEach((p: any) => profileMap.set(p.id, p));
  }
  function nameOf(id: string | null | undefined) {
    if (!id) return "—";
    const p = profileMap.get(id);
    return p?.full_name ?? p?.username ?? "—";
  }

  const events: { type: string; at: string; label: string }[] = [];
  (recentSignupsRes.data ?? []).forEach((p: any) =>
    events.push({ type: "signup", at: p.created_at, label: p.full_name ?? p.username ?? "new founder" }),
  );
  (recentPostsRes.data ?? []).forEach((p: any) =>
    events.push({ type: "post", at: p.created_at, label: nameOf(p.author_id) }),
  );
  (recentNomsRes.data ?? []).forEach((n: any) =>
    events.push({ type: "nomination", at: n.created_at, label: nameOf(n.nominated_by) }),
  );
  (recentHandshakesRes.data ?? []).forEach((h: any) =>
    events.push({
      type: "handshake",
      at: h.created_at,
      label: `${nameOf(h.initiator_id)} ↔ ${nameOf(h.recipient_id)}`,
    }),
  );
  events.sort((a, b) => (a.at < b.at ? 1 : -1));

  return NextResponse.json({
    totalUsers: totalUsersRes.count ?? 0,
    pendingApproval: pendingRes.count ?? 0,
    activeThisWeek: activeUserIds.size,
    postsThisWeek: postsWeekRes.count ?? 0,
    newSignupsThisWeek: signupsWeekRes.count ?? 0,
    tierCounts,
    signupsSeries,
    postsSeries,
    checkinsSeries,
    events: events.slice(0, 10),
  });
}
