import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { vouched_for_id, note } = await req.json().catch(() => ({}));
  if (!vouched_for_id || typeof vouched_for_id !== "string") {
    return NextResponse.json({ error: "missing vouched_for_id" }, { status: 400 });
  }
  if (vouched_for_id === user.id) {
    return NextResponse.json({ error: "cannot vouch for yourself" }, { status: 400 });
  }

  const { error } = await supabase.from("vouches").insert({
    voucher_id: user.id,
    vouched_for_id,
    note: typeof note === "string" ? note.slice(0, 280) : null,
  });
  if (error && !error.message.includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { vouched_for_id } = await req.json().catch(() => ({}));
  if (!vouched_for_id) {
    return NextResponse.json({ error: "missing vouched_for_id" }, { status: 400 });
  }
  const { error } = await supabase
    .from("vouches")
    .delete()
    .eq("voucher_id", user.id)
    .eq("vouched_for_id", vouched_for_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
