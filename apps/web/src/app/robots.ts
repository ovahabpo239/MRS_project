import type { MetadataRoute } from "next";
import { getEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/account", "/admin"] },
    sitemap: `${getEnv().SITE_URL}/sitemap.xml`,
  };
}
