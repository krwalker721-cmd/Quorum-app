import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Returns the most recent active feedback question the current user has not yet
// answered or dismissed, scoped to their audience tier.
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ question: null });

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();
  const tier = profile?.tier ?? "free";

  const admin = createAdminClient();
  const audienceFilters = ["all_users"];
  if (tier === "free") audienceFilters.push("free_only");
  if (tier === "tier_1") audienceFilters.push("tier_1_only");
  if (tier === "tier_2") audienceFilters.push("tier_2_only");

  const { data: questions } = await admin
    .from("feedback_questions")
    .select("id, question, question_type, options, target_audience, status")
    .eq("status", "active")
    .in("target_audience", audienceFilters)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!questions || questions.length === 0) {
    return NextResponse.json({ question: null });
  }

  const ids = questions.map((q: any) => q.id);
  const [respRes, dismRes] = await Promise.all([
    admin.from("feedback_responses").select("question_id").eq("user_id", user.id).in("question_id", ids),
    admin.from("feedback_dismissals").select("question_id").eq("user_id", user.id).in("question_id", ids),
  ]);
  const seen = new Set<string>([
    ...(respRes.data ?? []).map((r: any) => r.question_id),
    ...(dismRes.data ?? []).map((r: any) => r.question_id),
  ]);
  const next = questions.find((q: any) => !seen.has(q.id));
  return NextResponse.json({ question: next ?? null });
}
