import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { generateToken, hashToken } = await import("@/server/auth/tokens");

describe("tokens", () => {
  it("generates long, unique, URL-safe tokens", () => {
    const tokens = new Set(Array.from({ length: 50 }, generateToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it("hashes deterministically and never returns the token itself", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).not.toBe(hashToken(generateToken()));
  });
});
