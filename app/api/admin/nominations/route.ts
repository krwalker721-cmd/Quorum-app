import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

export async function GET(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const admin = createAdminClient();

  const { data: noms, error } = await admin
    .from("vault_nominations")
    .select("id, post_id, nominated_by, reason, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const postIds = Array.from(new Set((noms ?? []).map((n: any) => n.post_id).filter(Boolean)));
  const { data: posts } = postIds.length
    ? await admin
        .from("posts")
        .select("id, content, tag, author_id, is_anonymous, created_at")
        .in("id", postIds)
    : { data: [] as any[] };
  const postMap = new Map<string, any>();
  (posts ?? []).forEach((p: any) => postMap.set(p.id, p));

  const userIds = Array.from(
    new Set([
      ...((noms ?? []).map((n: any) => n.nominated_by).filter(Boolean) as string[]),
      ...((posts ?? []).map((p: any) => p.author_id).filter(Boolean) as string[]),
    ]),
  );
  const profMap = new Map<string, any>();
  if (userIds.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name, username")
      .in("id", userIds);
    (profs ?? []).forEach((p: any) => profMap.set(p.id, p));
  }

  const hydrated = (noms ?? []).map((n: any) => {
    const post = postMap.get(n.post_id) ?? null;
    return {
      ...n,
      post,
      author: post?.author_id ? profMap.get(post.author_id) ?? null : null,
      nominator: n.nominated_by ? profMap.get(n.nominated_by) ?? null : null,
    };
  });

  return NextResponse.json({ nominations: hydrated });
}
