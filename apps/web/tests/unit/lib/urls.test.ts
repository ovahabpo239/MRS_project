import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/urls";

describe("safeNextPath", () => {
  it("keeps same-site paths, including query strings", () => {
    expect(safeNextPath("/projects/resonance")).toBe("/projects/resonance");
    expect(safeNextPath("/account?tab=1")).toBe("/account?tab=1");
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "projects",
    "/ok\nSet-Cookie: x=1",
    "",
  ])("falls back for %j", (value) => {
    expect(safeNextPath(value)).toBe("/account");
  });

  it("falls back for non-strings and honours a custom fallback", () => {
    expect(safeNextPath(undefined)).toBe("/account");
    expect(safeNextPath(["/a"], "/")).toBe("/");
  });
});
