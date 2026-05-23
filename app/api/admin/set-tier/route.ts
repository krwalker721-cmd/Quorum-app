import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

const ALLOWED = new Set(["free", "tier_1", "tier_2"]);

export async function POST(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "admin locked" }, { status: 403 });
  }

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
