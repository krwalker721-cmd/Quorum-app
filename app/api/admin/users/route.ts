import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

export async function GET(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const filter = url.searchParams.get("filter") ?? "all";

  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select(
      "id, full_name, email, username, stage, status, tier, trust_score, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (filter === "pending") query = query.eq("status", "pending");
  else if (filter === "approved") query = query.eq("status", "approved");
  else if (filter === "suspended") query = query.eq("status", "suspended");
  else if (filter === "tier_free") query = query.eq("tier", "free");
  else if (filter === "tier_member") query = query.eq("tier", "member");
  else if (filter === "tier_partner") query = query.eq("tier", "partner");

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,username.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // hydrate last_active from sessions (best-effort)
  const ids = (data ?? []).map((d: any) => d.id);
  const lastActiveMap = new Map<string, string>();
  if (ids.length) {
    const { data: sess } = await admin
      .from("sessions")
      .select("user_id, created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false });
    (sess ?? []).forEach((s: any) => {
      if (!lastActiveMap.has(s.user_id)) lastActiveMap.set(s.user_id, s.created_at);
    });
  }

  const users = (data ?? []).map((u: any) => ({
    ...u,
    last_active_at: lastActiveMap.get(u.id) ?? null,
  }));

  return NextResponse.json({ users });
}
