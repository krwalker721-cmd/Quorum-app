import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isAdminUnlocked } from "@/app/admin/session";

const ALLOWED = new Set(["free", "tier_1", "tier_2"]);

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdminUnlocked()) return NextResponse.json({ error: "admin locked" }, { status: 403 });

  const { id, tier } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  if (!tier || typeof tier !== "string" || !ALLOWED.has(tier)) {
    return NextResponse.json({ error: "invalid tier" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ tier }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
