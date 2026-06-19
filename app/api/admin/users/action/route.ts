import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";
import { initializeUserSubscription } from "@/lib/stripe-helpers";

const TIERS = new Set(["free", "member", "partner"]);

export async function POST(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({} as any));
  const action: string = body.action;
  const ids: string[] = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];
  if (!action || ids.length === 0) {
    return NextResponse.json({ error: "missing action or id" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (action === "approve") {
    const { error } = await admin
      .from("profiles")
      .update({ status: "approved" })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Start each approved user's trial (7-day cold signup; no referral source yet).
    for (const id of ids) {
      try {
        await initializeUserSubscription(id, false);
      } catch (e) {
        console.error("initializeUserSubscription failed on approve:", e);
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "suspend") {
    const { error } = await admin
      .from("profiles")
      .update({ status: "suspended" })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Also sign out their sessions (best-effort).
    for (const id of ids) {
      try {
        await admin.auth.admin.signOut(id);
      } catch {}
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "unsuspend") {
    const { error } = await admin
      .from("profiles")
      .update({ status: "approved" })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "change_tier") {
    const tier: string = body.tier;
    if (!TIERS.has(tier)) {
      return NextResponse.json({ error: "invalid tier" }, { status: 400 });
    }
    const { error } = await admin.from("profiles").update({ tier }).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    const confirmUsername: string | undefined = body.confirm_username;
    if (ids.length !== 1) {
      return NextResponse.json({ error: "delete is single-id only" }, { status: 400 });
    }
    const { data: prof } = await admin
      .from("profiles")
      .select("id, username")
      .eq("id", ids[0])
      .single();
    if (!prof) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!confirmUsername || confirmUsername !== prof.username) {
      return NextResponse.json({ error: "username confirmation mismatch" }, { status: 400 });
    }
    // delete auth user (cascades profile via FK on delete cascade)
    try {
      await admin.auth.admin.deleteUser(ids[0]);
    } catch (e: any) {
      // fall back to deleting the profile row
      await admin.from("profiles").delete().eq("id", ids[0]);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
