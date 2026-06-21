import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkUsageCap, incrementUsage } from "@/lib/stripe-helpers";

// Server-side reply creation. Replies are stored as posts with a parent_post_id
// and count toward the free-tier `replies` cap, enforced here as a safety net.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { content, parent_post_id, post_type, cohort_id, is_anonymous, local_hour } = body ?? {};

  if (!content || !parent_post_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { allowed, current, limit } = await checkUsageCap(user.id, "replies");
  if (!allowed) {
    return NextResponse.json(
      { error: "Usage limit reached", code: "CAP_EXCEEDED", feature: "replies", current, limit },
      { status: 403 },
    );
  }

  const payload: Record<string, unknown> = {
    author_id: user.id,
    content,
    post_type: post_type || "question",
    parent_post_id,
  };
  if (cohort_id !== undefined) payload.cohort_id = cohort_id;
  if (is_anonymous !== undefined) payload.is_anonymous = is_anonymous;
  if (local_hour !== undefined) payload.local_hour = local_hour;

  // Return the same shape the client previously selected so it can hydrate the
  // new reply into the thread without a refetch.
  const { data: reply, error } = await supabase
    .from("posts")
    .insert(payload)
    .select("id, author_id, content, is_anonymous, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await incrementUsage(user.id, "replies");

  return NextResponse.json({ reply });
}
