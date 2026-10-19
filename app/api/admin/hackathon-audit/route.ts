import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

// Read-only view of hackathon_admin_audit (migration 021): every admin edit to
// a Sprint submission or score made after its deadline. The log is written by
// database triggers and is append-only, so there is nothing to POST here.
export async function GET(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: entries, error } = await admin
    .from("hackathon_admin_audit")
    .select("id, hackathon_id, table_name, row_id, action, subject, changes, actor, deadline, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = Array.from(new Set((entries ?? []).map((e) => e.hackathon_id)));
  const sprints = new Map<string, { number: number; title: string }>();
  if (ids.length) {
    const { data } = await admin.from("hackathons").select("id, number, title").in("id", ids);
    (data ?? []).forEach((s) => sprints.set(s.id, { number: s.number, title: s.title }));
  }

  return NextResponse.json({
    entries: (entries ?? []).map((e) => ({ ...e, sprint: sprints.get(e.hackathon_id) ?? null })),
  });
}
