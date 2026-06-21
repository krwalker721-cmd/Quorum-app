import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkUsageCap, incrementUsage } from "@/lib/stripe-helpers";

// Server-side DM creation. Direct messages count toward the free-tier `messages`
// cap, enforced here so the API can't be called directly to bypass it.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { content, recipient_id } = body ?? {};

  if (!content || !recipient_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { allowed, current, limit } = await checkUsageCap(user.id, "messages");
  if (!allowed) {
    return NextResponse.json(
      { error: "Usage limit reached", code: "CAP_EXCEEDED", feature: "messages", current, limit },
      { status: 403 },
    );
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({ sender_id: user.id, recipient_id, content })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await incrementUsage(user.id, "messages");

  return NextResponse.json({ message });
}
