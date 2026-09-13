import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest } from "@/lib/admin/auth";
import { approveUser, type ApproveOutcome } from "@/lib/admin/approve";

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
    // The same steps as approving one person (lib/admin/approve.ts): referred
    // trials, referral code, cohort. One at a time, in the order given, so a
    // group of twelve fills a cohort predictably.
    const outcomes: ApproveOutcome[] = [];
    for (const id of ids) outcomes.push(await approveUser(admin, id));

    const approved = outcomes.filter((o) => o.result === "approved").length;
    const skipped = outcomes.filter((o) => o.result === "skipped").length;
    const failed = outcomes.filter((o) => o.result === "failed");
    if (failed.length > 0) {
      // Surface partial failures — the panel alerts on a non-2xx.
      return NextResponse.json(
        {
          error: `approved ${approved}, skipped ${skipped}, failed ${failed.length}: ${failed[0].reason}`,
          failed: failed.map((o) => ({ id: o.id, reason: o.reason })),
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, approved, skipped });
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
    // The billing row carries the tier too, and the lapse check (lib/lapse.ts)
    // reads only that row. Updating the profile alone left a comped member
    // looking lapsed, so the daily seat-release job could still take their
    // seat. A member with no billing row yet (never approved) has nothing to
    // update, which is fine.
    const { error: subError } = await admin.from("subscriptions").update({ tier }).in("user_id", ids);
    if (subError) return NextResponse.json({ error: subError.message }, { status: 500 });
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
