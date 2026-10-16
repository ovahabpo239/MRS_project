import { describe, expect, it, vi } from "vitest";

// `server-only` throws outside a React Server environment; neutralise it for unit tests.
vi.mock("server-only", () => ({}));

const { parseEnv } = await import("./env");

describe("parseEnv", () => {
  it("applies defaults", () => {
    expect(parseEnv({}).SITE_URL).toBe("http://localhost:5003");
  });

  it("accepts a valid SITE_URL", () => {
    expect(parseEnv({ SITE_URL: "https://example.com" }).SITE_URL).toBe("https://example.com");
  });

  it("fails fast with a readable message on invalid input", () => {
    expect(() => parseEnv({ SITE_URL: "not a url" })).toThrow(/Invalid environment configuration/);
  });
});
