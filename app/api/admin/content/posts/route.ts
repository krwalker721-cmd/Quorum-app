import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

export async function GET(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const postType = url.searchParams.get("post_type");
  const tag = url.searchParams.get("tag");

  const admin = createAdminClient();
  let query = admin
    .from("posts")
    .select("id, content, tag, post_type, author_id, reply_count, is_anonymous, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (postType && (postType === "cohort" || postType === "pulse")) {
    query = query.eq("post_type", postType);
  }
  if (tag) query = query.eq("tag", tag);
  if (q) query = query.ilike("content", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = Array.from(
    new Set((data ?? []).map((p: any) => p.author_id).filter(Boolean)),
  );
  const authorMap = new Map<string, any>();
  if (ids.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name, username")
      .in("id", ids);
    (profs ?? []).forEach((p: any) => authorMap.set(p.id, p));
  }

  const posts = (data ?? []).map((p: any) => ({
    ...p,
    author: p.author_id ? authorMap.get(p.author_id) ?? null : null,
  }));

  return NextResponse.json({ posts });
}

export async function DELETE(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const { id, notify } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  const admin = createAdminClient();

  if (notify) {
    const { data: post } = await admin
      .from("posts")
      .select("author_id")
      .eq("id", id)
      .single();
    if (post?.author_id) {
      await admin.from("notifications").insert({
        user_id: post.author_id,
        kind: "post_removed",
        message: "your post was removed",
      });
    }
  }

  const { error } = await admin.from("posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
