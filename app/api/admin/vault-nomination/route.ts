import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

export async function POST(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { nomination_id, action } = body;
  const admin = createAdminClient();

  // Admins can nominate a post directly from the content moderation section.
  // This creates a pending nomination that then shows up in the review section.
  if (action === "create") {
    const postId = body?.post_id;
    if (typeof postId !== "string") {
      return NextResponse.json({ error: "missing post_id" }, { status: 400 });
    }
    const reason = typeof body?.reason === "string" ? body.reason.slice(0, 600) : null;
    // Avoid stacking duplicate pending nominations for the same post — a null
    // nominated_by sidesteps the (post_id, nominated_by) unique constraint.
    const { data: existing } = await admin
      .from("vault_nominations")
      .select("id")
      .eq("post_id", postId)
      .neq("status", "declined")
      .limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true, already: true });
    }
    const { error } = await admin
      .from("vault_nominations")
      .insert({ post_id: postId, nominated_by: null, reason });
    if (error && !error.message.includes("duplicate")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (typeof nomination_id !== "string" || (action !== "approve" && action !== "decline")) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

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
