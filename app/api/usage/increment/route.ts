import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  incrementUsage,
  getUserTier,
  type UsageFeature,
} from "@/lib/stripe-helpers";

const VALID_FEATURES: UsageFeature[] = [
  "cohort_posts",
  "pulse_posts",
  "replies",
  "messages",
  "vault_notes",
  "collab_posts",
];

// POST — called after an action succeeds to bump the monthly counter. Only free
// tier usage is tracked; paid tiers are uncapped and skip tracking entirely.
export async function POST(req: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { feature } = await req.json();

  if (!VALID_FEATURES.includes(feature)) {
    return NextResponse.json({ error: "Invalid feature" }, { status: 400 });
  }

  const tier = await getUserTier(user.id);
  if (tier !== "free") {
    return NextResponse.json({ success: true, tracked: false });
  }

  await incrementUsage(user.id, feature as UsageFeature);

  return NextResponse.json({ success: true, tracked: true });
}
