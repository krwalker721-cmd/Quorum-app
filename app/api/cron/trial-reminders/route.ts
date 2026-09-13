import { NextRequest, NextResponse } from "next/server";
import { sendTrialReminders } from "@/lib/email/trial-reminders";

// Run once a day by Vercel Cron (vercel.json). Vercel sends
// `Authorization: Bearer $CRON_SECRET` when that env var is set; anything
// without it is turned away, so nobody else can trigger a batch of emails.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const run = await sendTrialReminders();
  // The summary lands in the Vercel function log, the place to check a run.
  console.log("[cron] trial-reminders", JSON.stringify(run));
  return NextResponse.json(run, { status: run.errors.length && !run.sent ? 500 : 200 });
}
