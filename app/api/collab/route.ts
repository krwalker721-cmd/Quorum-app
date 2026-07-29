import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkUsageCap, incrementUsage } from "@/lib/stripe-helpers";

// Server-side collab creation (projects and needs both live in the `projects`
// table, distinguished by post_type). Viewing the board is open to every tier;
// creation is bounded by the per-tier `collab_posts` usage cap. The cap check
// below is the authoritative gate (free tier's cap is 0, so free users can
// browse the board but not post until they upgrade).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { title, name, description, category, looking_for, status, post_type } = body ?? {};

  if (!title || !post_type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { allowed } = await checkUsageCap(user.id, "collab_posts");
  if (!allowed) {
    return NextResponse.json(
      {
        error: "Upgrade your plan to post on the collab board",
        code: "UPGRADE_REQUIRED",
        feature: "collab_posts",
      },
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
