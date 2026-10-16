import type { MetadataRoute } from "next";
import { listProjects } from "@/features/projects";
import { getEnv } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getEnv().SITE_URL;
  return [
    { url: `${base}/` },
    { url: `${base}/projects` },
    { url: `${base}/about` },
    ...listProjects().map((project) => ({ url: `${base}/projects/${project.slug}` })),
  ];
}
