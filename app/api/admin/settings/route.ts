import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminRequest, getAdminCode } from "@/lib/admin/auth";

const SAFE_KEYS = new Set(["platform_status", "welcome_message", "maintenance_mode"]);
const STATUS_VALUES = new Set(["open", "waitlist"]);

export async function GET(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["platform_status", "welcome_message", "maintenance_mode"]);

  const settings: Record<string, string> = {
    platform_status: "waitlist",
    welcome_message: "welcome to quorum. you're in the room now.",
    maintenance_mode: "false",
  };
  (data ?? []).forEach((r: any) => {
    settings[r.key] = r.value;
  });
  return NextResponse.json({ settings });
}

export async function POST(req: Request) {
  if (!(await verifyAdminRequest(req))) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({} as any));
  const admin = createAdminClient();

  // Admin code change is a separate flow: { kind: "change_code", current, next }
  if (body.kind === "change_code") {
    const current = String(body.current ?? "");
    const next = String(body.next ?? "");
    const expected = await getAdminCode();
    if (!expected || current !== expected) {
      return NextResponse.json({ error: "current code incorrect" }, { status: 400 });
    }
    if (!next || next.length < 4) {
      return NextResponse.json({ error: "new code too short" }, { status: 400 });
    }
    await admin
      .from("platform_settings")
      .upsert(
        { key: "admin_code", value: next, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    return NextResponse.json({ ok: true });
  }

  const key = String(body.key ?? "");
  const value = String(body.value ?? "");
  if (!SAFE_KEYS.has(key)) {
    return NextResponse.json({ error: "invalid key" }, { status: 400 });
  }
  if (key === "platform_status" && !STATUS_VALUES.has(value)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (key === "maintenance_mode" && value !== "true" && value !== "false") {
    return NextResponse.json({ error: "invalid bool" }, { status: 400 });
  }

  const { error } = await admin
    .from("platform_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
