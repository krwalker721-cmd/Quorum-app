import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

export async function GET(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const admin = createAdminClient();

  const { data: reports, error } = await admin
    .from("reports")
    .select("id, post_id, reported_by, reason, note, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const postIds = Array.from(new Set((reports ?? []).map((r: any) => r.post_id).filter(Boolean)));
  const userIds = Array.from(new Set((reports ?? []).map((r: any) => r.reported_by).filter(Boolean)));

  const [postsRes, profsRes] = await Promise.all([
    postIds.length
      ? admin
          .from("posts")
          .select("id, content, tag, post_type, author_id, is_anonymous, created_at")
          .in("id", postIds)
      : Promise.resolve({ data: [] as any[] }),
    Promise.resolve(null as any),
  ]);

  const postMap = new Map<string, any>();
  (postsRes.data ?? []).forEach((p: any) => postMap.set(p.id, p));

  const authorIds = Array.from(
    new Set([
      ...userIds,
      ...((postsRes.data ?? []).map((p: any) => p.author_id).filter(Boolean) as string[]),
    ]),
  );
  const profileMap = new Map<string, any>();
  if (authorIds.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name, username")
      .in("id", authorIds);
    (profs ?? []).forEach((p: any) => profileMap.set(p.id, p));
  }

  const hydrated = (reports ?? []).map((r: any) => {
    const post = postMap.get(r.post_id) ?? null;
    return {
      ...r,
      post,
      post_author: post?.author_id ? profileMap.get(post.author_id) ?? null : null,
      reporter: r.reported_by ? profileMap.get(r.reported_by) ?? null : null,
    };
  });

  return NextResponse.json({ reports: hydrated });
}

export async function POST(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const { id, action } = await req.json().catch(() => ({}));
  if (!id || (action !== "dismiss" && action !== "remove")) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: report } = await admin
    .from("reports")
    .select("id, post_id")
    .eq("id", id)
    .single();
  if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (action === "dismiss") {
    await admin.from("reports").update({ status: "dismissed" }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  // remove
  const { data: post } = await admin
    .from("posts")
    .select("author_id")
    .eq("id", report.post_id)
    .single();
  if (post?.author_id) {
    await admin.from("notifications").insert({
      user_id: post.author_id,
      kind: "post_removed",
      message: "your post was removed",
    });
  }
  await admin.from("posts").delete().eq("id", report.post_id);
  await admin
    .from("reports")
    .update({ status: "actioned" })
    .eq("post_id", report.post_id);

  return NextResponse.json({ ok: true });
}
