import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST — permanently delete the authenticated user's account. Removes the auth
// user via the service-role client; ON DELETE CASCADE on profiles (and the rows
// that reference it) cleans up the rest. Best-effort: a failure to delete a
// dependent table must not block removing the auth user.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Drop the profile row explicitly first (cascades to most child rows). If the
  // schema already cascades from auth.users this is a harmless no-op.
  try {
    await admin.from("profiles").delete().eq("id", user.id);
  } catch (e) {
    console.error("account delete — profile cleanup failed:", e);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("account delete — auth deletion failed:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  // Clear the session cookie on the way out.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
