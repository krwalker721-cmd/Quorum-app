import { NextRequest, NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cron";
import { sendTrialReminders } from "@/lib/email/trial-reminders";

// Run once a day by Vercel Cron (vercel.json). Anything without the cron
// secret is turned away, so nobody else can trigger a batch of emails.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const run = await sendTrialReminders();
  // The summary lands in the Vercel function log, the place to check a run.
  console.log("[cron] trial-reminders", JSON.stringify(run));
  return NextResponse.json(run, { status: run.errors.length && !run.sent ? 500 : 200 });
}
