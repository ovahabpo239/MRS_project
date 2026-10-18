import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { hashPassword, verifyPassword, verifyAgainstDummy } = await import("@/server/auth/password");

describe("passwords", () => {
  it("hashes with argon2id and a unique salt each time", async () => {
    const [a, b] = await Promise.all([
      hashPassword("secret-password"),
      hashPassword("secret-password"),
    ]);
    expect(a).toMatch(/^\$argon2id\$/);
    expect(a).not.toBe(b);
  });

  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("secret-password");
    expect(await verifyPassword(hash, "secret-password")).toBe(true);
    expect(await verifyPassword(hash, "Secret-password")).toBe(false);
  });

  it("treats a malformed stored hash as a failed login, not an error", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
    expect(await verifyPassword("", "anything")).toBe(false);
  });

  it("the dummy verification always fails", async () => {
    expect(await verifyAgainstDummy("anything")).toBe(false);
  });
});
