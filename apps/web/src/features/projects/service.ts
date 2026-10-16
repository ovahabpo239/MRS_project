import { projects } from "./catalog";
import type { Project, ProjectUpdate } from "./schema";

export type FeedItem = ProjectUpdate & { projectSlug: string; projectTitle: string };

export function listProjects(): readonly Project[] {
  return projects;
}

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

/** Newest updates across all projects, for the landing page feed. */
export function recentUpdates(limit = 5): FeedItem[] {
  return projects
    .flatMap((project) =>
      project.updates.map((update) => ({
        ...update,
        projectSlug: project.slug,
        projectTitle: project.title,
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function projectStats() {
  return {
    total: projects.length,
    live: projects.filter((project) => project.status === "live").length,
  };
}
