import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkUsageCap, incrementUsage } from "@/lib/stripe-helpers";

// Server-side creation for pulse + cohort posts. The client gates first, but the
// cap is enforced here too so the API can't be called directly to bypass the
// free-tier limits. Cohort posts (cohort_id present) count toward cohort_posts;
// everything else counts toward pulse_posts.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { content, post_type, cohort_id, room_type, tag, is_anonymous, local_hour } = body ?? {};

  if (!content || !post_type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const feature = cohort_id ? "cohort_posts" : "pulse_posts";

  // Denied means "no live trial, nothing paid" — there is no metered free rung to
  // exhaust, so the response says upgrade rather than inventing a usage limit.
  // The client turns this code into the upgrade overlay.
  const { allowed } = await checkUsageCap(user.id, feature);
  if (!allowed) {
    return NextResponse.json(
      { error: "Upgrade your plan to post", code: "UPGRADE_REQUIRED", feature },
      { status: 403 },
    );
  }

  // Carry through only the fields the existing client inserts; author_id is
  // always taken from the session, never the request body.
  const payload: Record<string, unknown> = { author_id: user.id, content, post_type };
  if (cohort_id !== undefined) payload.cohort_id = cohort_id;
  if (room_type !== undefined) payload.room_type = room_type;
  if (tag !== undefined) payload.tag = tag;
  if (is_anonymous !== undefined) payload.is_anonymous = is_anonymous;
  if (local_hour !== undefined) payload.local_hour = local_hour;

  const { data: post, error } = await supabase.from("posts").insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await incrementUsage(user.id, feature);

  return NextResponse.json({ post });
}
