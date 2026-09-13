import { NextResponse } from "next/server";
import { checkAdminCode } from "@/lib/admin/auth";

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || !code) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const result = await checkAdminCode(req, code);
  if (result === "locked") {
    return NextResponse.json({ ok: false, error: "too many attempts" }, { status: 429 });
  }
  if (result === "wrong") {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
