import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

const TYPES = new Set(["open_text", "multiple_choice", "rating"]);
const AUDIENCES = new Set(["all_users", "tier_1_only", "tier_2_only", "free_only"]);

export async function GET(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: questions, error } = await admin
    .from("feedback_questions")
    .select("id, question, question_type, options, target_audience, status, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // attach response counts
  const ids = (questions ?? []).map((q: any) => q.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data } = await admin
      .from("feedback_responses")
      .select("question_id")
      .in("question_id", ids);
    (data ?? []).forEach((r: any) => {
      counts.set(r.question_id, (counts.get(r.question_id) ?? 0) + 1);
    });
  }
  const hydrated = (questions ?? []).map((q: any) => ({
    ...q,
    response_count: counts.get(q.id) ?? 0,
  }));

  return NextResponse.json({ questions: hydrated });
}

export async function POST(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({} as any));
  const question: string = (body.question ?? "").trim();
  const question_type: string = body.question_type;
  const target_audience: string = body.target_audience ?? "all_users";
  const options: string[] = Array.isArray(body.options) ? body.options : [];

  if (!question) return NextResponse.json({ error: "missing question" }, { status: 400 });
  if (!TYPES.has(question_type)) return NextResponse.json({ error: "invalid type" }, { status: 400 });
  if (!AUDIENCES.has(target_audience))
    return NextResponse.json({ error: "invalid audience" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feedback_questions")
    .insert({ question, question_type, target_audience, options, status: "active" })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const { id, status } = await req.json().catch(() => ({}));
  if (!id || (status !== "closed" && status !== "active")) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("feedback_questions")
    .update({ status })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
