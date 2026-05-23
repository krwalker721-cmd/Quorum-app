import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const admin = createAdminClient();
  const format = new URL(req.url).searchParams.get("format");

  const { data: question } = await admin
    .from("feedback_questions")
    .select("id, question, question_type, options")
    .eq("id", params.id)
    .single();
  if (!question) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: responses, error } = await admin
    .from("feedback_responses")
    .select("id, user_id, response, created_at")
    .eq("question_id", params.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = Array.from(new Set((responses ?? []).map((r: any) => r.user_id).filter(Boolean)));
  const profMap = new Map<string, any>();
  if (userIds.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name, username")
      .in("id", userIds);
    (profs ?? []).forEach((p: any) => profMap.set(p.id, p));
  }
  const hydrated = (responses ?? []).map((r: any) => ({
    ...r,
    user: r.user_id ? profMap.get(r.user_id) ?? null : null,
  }));

  if (format === "csv") {
    const rows = [
      ["created_at", "user_name", "username", "response"].join(","),
      ...hydrated.map((r) =>
        [
          r.created_at,
          JSON.stringify(r.user?.full_name ?? ""),
          JSON.stringify(r.user?.username ?? ""),
          JSON.stringify(r.response ?? ""),
        ].join(","),
      ),
    ].join("\n");
    return new NextResponse(rows, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="feedback-${params.id}.csv"`,
      },
    });
  }

  return NextResponse.json({ question, responses: hydrated });
}
