import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isAdminUnlocked } from "@/app/admin/session";

export async function POST(req: Request) {
  if (!isAdminUnlocked()) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const { nomination_id, action } = await req.json().catch(() => ({}));
  if (typeof nomination_id !== "string" || (action !== "approve" && action !== "decline")) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: nom, error: nomErr } = await admin
    .from("vault_nominations")
    .select("id, post_id, nominated_by, reason, status")
    .eq("id", nomination_id)
    .single();
  if (nomErr || !nom) {
    return NextResponse.json({ error: "nomination not found" }, { status: 404 });
  }

  if (action === "decline") {
    await admin.from("vault_nominations").update({ status: "declined" }).eq("id", nomination_id);
    return NextResponse.json({ ok: true });
  }

  await admin.from("vault_nominations").update({ status: "approved" }).eq("id", nomination_id);
  const { error: insErr } = await admin.from("community_wisdom").insert({
    post_id: nom.post_id,
    nominated_by: nom.nominated_by,
    nomination_reason: nom.reason,
    approved_at: new Date().toISOString(),
  });
  if (insErr && !insErr.message.includes("duplicate")) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
