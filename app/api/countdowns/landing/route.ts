import { NextResponse } from "next/server";
import { fetchLandingRelayData } from "@/lib/landingRelayData";

// What the landing page's countdown relay re-checks every 30 seconds while
// it's open (Phase 11). Public by design, and only public fields: standalone
// countdowns switched on for the landing page, and the Sprints' relay data
// (migration 033: no theme, no team content, no ids). Cached at the edge for
// 20 seconds, so with the page's own re-check an admin's change shows within
// about a minute, without a redeploy.
export async function GET() {
  try {
    const data = await fetchLandingRelayData();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=20, stale-while-revalidate=10" },
    });
  } catch {
    return NextResponse.json({ site: [], sprints: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
