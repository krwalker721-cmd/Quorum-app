import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

// Admin sign-in. Both locks must pass: a signed-in Quorum account marked as an
// admin, and the admin code. The reason comes back so the screen can say which
// one is missing.
export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || !code) {
    return NextResponse.json({ ok: false, reason: "wrong_code" }, { status: 400 });
  }
  const check = await requireAdmin(req, code);
  if (!check.ok) {
    return NextResponse.json({ ok: false, reason: check.reason }, { status: check.status });
  }
  return NextResponse.json({ ok: true, name: check.admin.name });
}

// Is the saved admin session still good? Used when the console opens, so a
// stale code or a signed-out account goes back to the sign-in screen.
export async function GET(req: Request) {
  const check = await requireAdmin(req);
  if (!check.ok) {
    return NextResponse.json({ ok: false, reason: check.reason }, { status: check.status });
  }
  return NextResponse.json({ ok: true, name: check.admin.name });
}
