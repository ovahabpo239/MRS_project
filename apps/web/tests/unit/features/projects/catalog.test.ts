import { describe, expect, it } from "vitest";
import { projects } from "@/features/projects/catalog";
import { projectSchema } from "@/features/projects/schema";
import { getProject, projectStats, recentUpdates } from "@/features/projects/service";

describe("project catalog", () => {
  it("has unique slugs", () => {
    const slugs = projects.map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only offers a try URL for projects that are available", () => {
    for (const project of projects.filter((p) => p.status === "soon")) {
      expect(project.tryUrl).toBeUndefined();
    }
  });
});

describe("projectSchema", () => {
  const valid = {
    slug: "my-project",
    title: "My project",
    summary: "Short",
    description: ["Long"],
    tags: ["TypeScript"],
    status: "live",
    requiresAccount: false,
    updates: [],
  };

  it("accepts a valid entry", () => {
    expect(projectSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["non kebab-case slug", { slug: "My Project" }],
    ["unknown status", { status: "retired" }],
    ["empty tags", { tags: [] }],
    ["invalid try URL", { tryUrl: "not a url" }],
    ["summary over 160 chars", { summary: "x".repeat(161) }],
  ])("rejects %s", (_name, override) => {
    expect(projectSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe("project service", () => {
  it("finds a project by slug and returns undefined otherwise", () => {
    expect(getProject("resonance")?.title).toBe("Resonance");
    expect(getProject("nope")).toBeUndefined();
  });

  it("returns updates newest first, honouring the limit", () => {
    const updates = recentUpdates(1);
    expect(updates).toHaveLength(1);
    const all = recentUpdates(100);
    const dates = all.map((update) => update.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("counts live projects", () => {
    const stats = projectStats();
    expect(stats.total).toBe(projects.length);
    expect(stats.live).toBe(projects.filter((p) => p.status === "live").length);
  });
});
