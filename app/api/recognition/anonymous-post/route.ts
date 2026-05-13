import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Called after a user posts anonymously. If they've never posted anonymously
 * before, queue the one-time "first honest" notice (shown once on home).
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("has_seen_first_honest_message")
    .eq("id", user.id)
    .single();

  if (profile?.has_seen_first_honest_message) {
    return NextResponse.json({ ok: true });
  }

  // Have they posted anonymously more than this one time? If yes, the notice
  // was either already shown earlier or we're catching up — either way set the
  // flag and bail.
  const { count: anonCount } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .eq("is_anonymous", true);

  // Best signal we have: only queue the notice on the first anonymous post.
  if ((anonCount ?? 0) > 1) {
    await supabase
      .from("profiles")
      .update({ has_seen_first_honest_message: true })
      .eq("id", user.id);
    return NextResponse.json({ ok: true });
  }

  // Queue notice — surfaces on next home load. We use the admin client so the
  // notice insert never trips RLS on shared infra.
  const admin = createAdminClient();
  await admin.from("recognition_notices").insert({
    user_id: user.id,
    kind: "first_honest",
  });
  return NextResponse.json({ ok: true });
}
