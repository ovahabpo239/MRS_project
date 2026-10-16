import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { siteConfig } from "@/config/site";

/**
 * Public URL of the CV PDF, or undefined if the file has not been added to `public/` yet.
 * Resolved at request/build time so the button never links to a 404.
 */
export function getCvDownloadHref(): string | undefined {
  const file = path.join(process.cwd(), "public", siteConfig.cvFile);
  return existsSync(file) ? `/${encodeURIComponent(siteConfig.cvFile)}` : undefined;
}
