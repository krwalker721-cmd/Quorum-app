import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "missing name" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("note_collections")
    .insert({ user_id: user.id, name: name.trim().slice(0, 80) })
    .select("id, name")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
