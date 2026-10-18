import { describe, expect, it, vi } from "vitest";

// `server-only` throws outside a React Server environment; neutralise it for unit tests.
vi.mock("server-only", () => ({}));

const { parseServerEnv, parseSiteEnv } = await import("@/lib/env");

describe("parseSiteEnv", () => {
  it("applies defaults", () => {
    expect(parseSiteEnv({}).SITE_URL).toBe("http://localhost:5003");
  });

  it("accepts a valid SITE_URL", () => {
    expect(parseSiteEnv({ SITE_URL: "https://example.com" }).SITE_URL).toBe("https://example.com");
  });

  it("fails fast with a readable message on invalid input", () => {
    expect(() => parseSiteEnv({ SITE_URL: "not a url" })).toThrow(
      /Invalid environment configuration/,
    );
  });
});

describe("parseServerEnv", () => {
  const valid = { DATABASE_URL: "postgres://u:p@localhost:5432/db", SMTP_HOST: "localhost" };

  it("parses and coerces values", () => {
    const env = parseServerEnv({ ...valid, SMTP_PORT: "1025", RUN_MIGRATIONS: "true" });
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.RUN_MIGRATIONS).toBe(true);
    expect(env.SMTP_SECURE).toBe(false);
  });

  it("requires a postgres URL and an SMTP host", () => {
    expect(() => parseServerEnv({})).toThrow(/DATABASE_URL/);
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL/);
  });

  it("rejects non-boolean flags", () => {
    expect(() => parseServerEnv({ ...valid, RUN_MIGRATIONS: "yes" })).toThrow(/RUN_MIGRATIONS/);
  });
});
