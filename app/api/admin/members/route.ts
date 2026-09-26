import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { guard } from "@/lib/admin/hackathons";

// Find approved members by name, username or email: the admin console's
// person picker (judges, manual teams).
export async function GET(req: Request) {
  const g = await guard(req);
  if (!g.ok) return g.response;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/[%,()]/g, "");
  if (q.length < 2) return NextResponse.json({ members: [] });

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, username, email")
    .eq("status", "approved")
    .or(`full_name.ilike.%${q}%,username.ilike.%${q}%,email.ilike.%${q}%`)
    .order("full_name")
    .limit(12);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}
