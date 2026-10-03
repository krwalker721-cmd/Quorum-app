import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TIMING_COLUMNS } from "@/lib/hackathons/sprint";
import { postLobbyMilestones } from "@/lib/hackathons/lobbyMilestones";

// What an open Sprint page re-checks every minute and when the tab comes back
// into view: the Sprint's stored times, pause/cancel, and the admin's
// countdown switches. If any of it changed, the page reloads its data, so a
// moved deadline shows up within about a minute instead of the countdown
// running to the old time.
//
// Read signed out, so it only ever answers for published Sprints (the same
// rows the landing page can see), and cached at the edge for 30 seconds like
// /api/countdowns. The time itself comes from /api/time, which is never cached.
//
// Every open Sprint page asks this every 30 s, so it's also where the lobby's
// milestone messages get posted on time without a per-minute cron (Vercel
// Hobby): at most once per edge cache period, and the database posts each
// milestone exactly once however often it's asked.
export async function GET(_req: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) return NextResponse.json({ error: "not found" }, { status: 404 });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db
    .from("hackathon_overview")
    .select(`id, ${TIMING_COLUMNS}`)
    .eq("number", n)
    .eq("is_published", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (!data) {
    // Unpublished or gone. Not cached, so republishing shows up at once.
    return NextResponse.json({ timing: null }, { headers: { "Cache-Control": "no-store" } });
  }
  const { id, ...timing } = data as unknown as { id: string } & Record<string, unknown>;
  await postLobbyMilestones(id);
  return NextResponse.json(
    { timing },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=30" } },
  );
}
