import type { MetadataRoute } from "next";
import { LEGAL } from "@/lib/legal";

// The public pages only. Everything a member sees sits behind sign-in.
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/pricing", "/signup", "/login", "/terms", "/privacy", "/refunds"].map((path) => ({
    url: `${LEGAL.site}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" || path === "/pricing" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/pricing" ? 0.8 : 0.5,
  }));
}
