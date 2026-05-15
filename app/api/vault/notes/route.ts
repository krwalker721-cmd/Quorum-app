import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: user.id, title: "", content: [{ type: "text", text: "" }], tags: [] })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function PATCH(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, title, content, tags, collection_id } = body ?? {};
  if (typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof title === "string") patch.title = title.slice(0, 240);
  if (Array.isArray(content)) patch.content = content;
  if (Array.isArray(tags)) patch.tags = tags.filter((t) => typeof t === "string").slice(0, 12);
  if (typeof collection_id === "string" || collection_id === null) patch.collection_id = collection_id;

  const { error } = await supabase.from("notes").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
