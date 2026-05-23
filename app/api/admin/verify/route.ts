import { NextResponse } from "next/server";
import { getAdminCode } from "@/lib/admin/auth";

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || !code) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const expected = await getAdminCode();
  if (!expected || code !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
