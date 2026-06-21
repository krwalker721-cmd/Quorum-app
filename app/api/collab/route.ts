import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkUsageCap, incrementUsage } from "@/lib/stripe-helpers";

// Server-side collab creation (projects and needs both live in the `projects`
// table, distinguished by post_type). collab_posts is 0 on the free tier, so the
// cap check here is the authoritative gate — this is a Member-only feature.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { title, name, description, category, looking_for, status, post_type } = body ?? {};

  if (!title || !post_type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { allowed, current, limit } = await checkUsageCap(user.id, "collab_posts");
  if (!allowed) {
    return NextResponse.json(
      { error: "Usage limit reached", code: "CAP_EXCEEDED", feature: "collab_posts", current, limit },
      { status: 403 },
    );
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      title,
      name: name ?? title,
      description: description ?? null,
      category,
      looking_for: looking_for ?? null,
      status: status ?? "open",
      post_type,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await incrementUsage(user.id, "collab_posts");

  return NextResponse.json({ project });
}
