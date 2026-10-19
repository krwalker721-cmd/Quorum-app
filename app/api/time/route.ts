import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// The database's clock, for working out how far a visitor's device clock is
// off. The database enforces every deadline, so countdowns match it rather
// than the device. Never cached: a stale "now" would skew every countdown.
export const dynamic = "force-dynamic";

export async function GET() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("server_now");
  // If the database can't be reached, the server's own (NTP-synced) clock is
  // the next best thing; either beats the device.
  const now = !error && typeof data === "string" ? new Date(data).toISOString() : new Date().toISOString();
  return NextResponse.json({ now }, { headers: { "Cache-Control": "no-store" } });
}
