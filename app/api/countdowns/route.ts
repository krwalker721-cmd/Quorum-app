import { NextResponse } from "next/server";
import { getPublicCountdowns } from "@/lib/countdowns";

// What the countdown strip and bar re-check every minute. Cached at the edge
// for 30 seconds, so a change in the admin panel reaches everyone within about
// a minute without a redeploy. The time itself comes from /api/time, which is
// never cached.
export async function GET(req: Request) {
  const where = new URL(req.url).searchParams.get("where") === "app" ? "app" : "landing";
  const countdowns = await getPublicCountdowns(where);
  return NextResponse.json(
    { countdowns },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=30" } },
  );
}
