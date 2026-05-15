import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TYPES = new Set(["pulse_post", "cohort_post", "project"]);

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { item_type, item_id, personal_note } = await req.json().catch(() => ({}));
  if (!TYPES.has(item_type) || typeof item_id !== "string") {
    return NextResponse.json({ error: "invalid item" }, { status: 400 });
  }
  const { error } = await supabase.from("saved_items").insert({
    user_id: user.id,
    item_type,
    item_id,
    personal_note: typeof personal_note === "string" ? personal_note.slice(0, 2000) : null,
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

  const { item_type, item_id } = await req.json().catch(() => ({}));
  if (!TYPES.has(item_type) || typeof item_id !== "string") {
    return NextResponse.json({ error: "invalid item" }, { status: 400 });
  }
  const { error } = await supabase
    .from("saved_items")
    .delete()
    .eq("user_id", user.id)
    .eq("item_type", item_type)
    .eq("item_id", item_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, personal_note } = await req.json().catch(() => ({}));
  if (typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  const { error } = await supabase
    .from("saved_items")
    .update({ personal_note: typeof personal_note === "string" ? personal_note.slice(0, 2000) : null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
