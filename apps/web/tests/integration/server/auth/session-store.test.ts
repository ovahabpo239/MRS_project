import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import { consume } from "@/server/security/rate-limit";
import { deleteSession, findSessionUser, insertSession } from "@/server/auth/session-store";
import { hashToken } from "@/server/auth/tokens";
import { resetDatabase } from "@tests/support/db";

async function createUser() {
  const [user] = await getDb()
    .insert(users)
    .values({ email: "alex@example.com", passwordHash: "x", emailVerifiedAt: new Date() })
    .returning();
  return user!;
}

beforeEach(resetDatabase);

describe("sessions", () => {
  it("resolves a token to its user and stores only a hash of it", async () => {
    const user = await createUser();
    const { token } = await insertSession(user.id);

    expect(await findSessionUser(token)).toEqual({
      id: user.id,
      email: user.email,
      role: "user",
      createdAt: user.createdAt,
    });

    const [row] = await getDb().select().from(sessions);
    expect(row?.tokenHash).toBe(hashToken(token));
    expect(row?.tokenHash).not.toBe(token);
  });

  it("rejects unknown, expired and deleted sessions", async () => {
    const user = await createUser();
    expect(await findSessionUser("not-a-real-token")).toBeNull();

    const { token } = await insertSession(user.id);
    await getDb()
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.tokenHash, hashToken(token)));
    expect(await findSessionUser(token)).toBeNull();

    const fresh = await insertSession(user.id);
    await deleteSession(fresh.token);
    expect(await findSessionUser(fresh.token)).toBeNull();
  });

  it("is removed together with its user", async () => {
    const user = await createUser();
    await insertSession(user.id);
    await getDb().delete(users).where(eq(users.id, user.id));
    expect(await getDb().select().from(sessions)).toHaveLength(0);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit within a window, then blocks", async () => {
    const rule = { limit: 2, windowSeconds: 60 };
    expect(await consume("t:a", rule)).toBe(true);
    expect(await consume("t:a", rule)).toBe(true);
    expect(await consume("t:a", rule)).toBe(false);
    // Keys are independent.
    expect(await consume("t:b", rule)).toBe(true);
  });

  it("starts a new window once the old one has elapsed", async () => {
    const rule = { limit: 1, windowSeconds: 1 };
    expect(await consume("t:c", rule)).toBe(true);
    expect(await consume("t:c", rule)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(await consume("t:c", rule)).toBe(true);
  });
});
