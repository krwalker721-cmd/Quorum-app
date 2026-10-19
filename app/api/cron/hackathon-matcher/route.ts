import { NextRequest, NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cron";
import { runDueMatchers } from "@/lib/hackathons/matcher";

// Runs the team matcher for every Sprint past team lock that hasn't been
// matched. Safe to call as often as you like: the matcher runs once per Sprint.
//
// NOT SCHEDULED YET. A per-minute Vercel Cron ("* * * * *") needs Vercel Pro;
// on Hobby a cron that runs more than once a day fails the deploy. Until then
// the Sprint page runs the matcher when it loads after team lock, and admins
// have the button. On Pro, add to vercel.json:
//   { "path": "/api/cron/hackathon-matcher", "schedule": "* * * * *" }

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const results = await runDueMatchers("team matcher (cron)");
    if (results.length) console.log("[cron] hackathon-matcher", JSON.stringify(results));
    return NextResponse.json({ ran: results });
  } catch (e) {
    console.error("[cron] hackathon-matcher failed:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
