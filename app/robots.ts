import type { MetadataRoute } from "next";
import { LEGAL } from "@/lib/legal";

// Crawlers may index the public pages. The API and the admin screen have
// nothing for them; the member pages redirect signed-out visitors to /login.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] },
    sitemap: `${LEGAL.site}/sitemap.xml`,
  };
}
