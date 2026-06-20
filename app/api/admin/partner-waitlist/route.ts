import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

// GET — everyone on the Partner waitlist, with their tier and referral counts,
// for the admin Partner waitlist section.
export async function GET(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: waitlist, error } = await admin
    .from("partner_waitlist")
    .select("user_id, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (waitlist ?? []).map((w) => w.user_id as string);

  // Profiles for tier + display.
  const profMap = new Map<string, { username: string | null; full_name: string | null; tier: string }>();
  if (ids.length) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username, full_name, tier")
      .in("id", ids);
    (profiles ?? []).forEach((p) =>
      profMap.set(p.id, {
        username: p.username,
        full_name: p.full_name,
        tier: p.tier ?? "free",
      }),
    );
  }

  // Referral counts per waitlisted user (total non-churned + active).
  const refTotal = new Map<string, number>();
  const refActive = new Map<string, number>();
  if (ids.length) {
    const { data: refs } = await admin
      .from("referrals")
      .select("referrer_id, status")
      .in("referrer_id", ids);
    (refs ?? []).forEach((r) => {
      const uid = r.referrer_id as string;
      if (r.status !== "churned") refTotal.set(uid, (refTotal.get(uid) ?? 0) + 1);
      if (r.status === "active") refActive.set(uid, (refActive.get(uid) ?? 0) + 1);
    });
  }

  const rows = (waitlist ?? []).map((w) => {
    const uid = w.user_id as string;
    const prof = profMap.get(uid);
    return {
      user_id: uid,
      username: prof?.username ?? null,
      full_name: prof?.full_name ?? null,
      tier: prof?.tier ?? "free",
      joined_at: w.created_at as string,
      referral_count: refTotal.get(uid) ?? 0,
      active_referral_count: refActive.get(uid) ?? 0,
    };
  });

  return NextResponse.json({ waitlist: rows, total: rows.length });
}
