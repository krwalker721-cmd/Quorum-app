import { NextRequest, NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cron";
import { releaseLapsedSeats } from "@/lib/lapse";

// Run once a day by Vercel Cron (vercel.json). Gives back the cohort seats of
// lapsed members who never open the app again; see releaseLapsedSeats().

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const run = await releaseLapsedSeats();
  console.log("[cron] release-seats", JSON.stringify(run));
  return NextResponse.json(run, { status: run.errors.length && !run.checked ? 500 : 200 });
}
