import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Log an introduction. Caller is the introducer; supplies the two people
 * being introduced. Duplicates are tolerated (unique not enforced) so the
 * UI can be lenient — we just need any matching row to award the connector.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { person_a_id, person_b_id } = await req.json().catch(() => ({}));
  if (!person_a_id || !person_b_id || person_a_id === person_b_id) {
    return NextResponse.json({ error: "two distinct people required" }, { status: 400 });
  }
  if (person_a_id === user.id || person_b_id === user.id) {
    return NextResponse.json({ error: "cannot include self" }, { status: 400 });
  }

  const { error } = await supabase.from("introductions").insert({
    introducer_id: user.id,
    person_a_id,
    person_b_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
