import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// POST — add the authenticated user to the Partner waitlist.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  await admin
    .from("partner_waitlist")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });
  await admin.from("profiles").update({ partner_waitlist: true }).eq("id", user.id);

  return NextResponse.json({ success: true });
}

// DELETE — remove the authenticated user from the Partner waitlist.
export async function DELETE() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  await admin.from("partner_waitlist").delete().eq("user_id", user.id);
  await admin.from("profiles").update({ partner_waitlist: false }).eq("id", user.id);

  return NextResponse.json({ success: true });
}
