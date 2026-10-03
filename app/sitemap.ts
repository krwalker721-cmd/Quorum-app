import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { LEGAL } from "@/lib/legal";

// The public pages only. Everything a member sees sits behind sign-in. Since
// Phase 10 that includes each revealed Sprint's recap and project pages,
// read signed out (migration 032 lists only revealed Sprints), and re-read
// hourly rather than fixed at build time.
export const revalidate = 3600;

const STATIC = ["/", "/pricing", "/signup", "/login", "/terms", "/privacy", "/refunds"];

async function sprintPages(): Promise<MetadataRoute.Sitemap> {
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db.rpc("hackathon_public_sitemap");
    if (error || !data) return [];
    // A recap with nothing shipped isn't worth a search result.
    return (data as { number: number; reveal_at: string; team_slugs: string[] }[]).filter((s) => s.team_slugs.length > 0).flatMap((s) => [
      { url: `${LEGAL.site}/hackathon/${s.number}/recap`, lastModified: new Date(s.reveal_at), changeFrequency: "monthly" as const, priority: 0.7 },
      ...s.team_slugs.map((slug) => ({
        url: `${LEGAL.site}/hackathon/${s.number}/project/${slug}`,
        lastModified: new Date(s.reveal_at),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ]);
  } catch {
    // Before migration 032, or the database is unreachable: the static pages still list.
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = STATIC.map((path) => ({
    url: `${LEGAL.site}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" || path === "/pricing" ? ("weekly" as const) : ("monthly" as const),
    priority: path === "/" ? 1 : path === "/pricing" ? 0.8 : 0.5,
  }));
  return [...base, ...(await sprintPages())];
}
