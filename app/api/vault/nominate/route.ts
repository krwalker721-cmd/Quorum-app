import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { post_id, reason } = await req.json().catch(() => ({}));
  if (typeof post_id !== "string") {
    return NextResponse.json({ error: "missing post_id" }, { status: 400 });
  }
  const { error } = await supabase.from("vault_nominations").insert({
    post_id,
    nominated_by: user.id,
    reason: typeof reason === "string" ? reason.slice(0, 600) : null,
  });
  if (error && !error.message.includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
