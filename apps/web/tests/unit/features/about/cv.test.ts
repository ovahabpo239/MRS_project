import { describe, expect, it } from "vitest";
import { cv } from "@/features/about/cv";

describe("cv data", () => {
  it("does not publish a phone number", () => {
    expect(JSON.stringify(cv)).not.toMatch(/\+\d{3}\s?\d{3}/);
  });

  it("has no empty bullet lists", () => {
    for (const job of cv.experience) {
      for (const group of job.groups) expect(group.bullets.length).toBeGreaterThan(0);
    }
    for (const project of cv.projects) expect(project.bullets.length).toBeGreaterThan(0);
  });

  it("uses unique keys for rendered lists", () => {
    const jobs = cv.experience.map((job) => `${job.organization}-${job.period}`);
    expect(new Set(jobs).size).toBe(jobs.length);
    const titles = cv.projects.map((project) => project.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
