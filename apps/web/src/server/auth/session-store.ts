import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "../db/client";
import { sessions, users } from "../db/schema";
import { generateToken, hashToken } from "./tokens";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  createdAt: Date;
};

/** Create a session row and return the raw token (shown once, only ever stored hashed). */
export async function insertSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getDb()
    .insert(sessions)
    .values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

/** Resolve a raw token to its user, ignoring expired sessions and unverified accounts. */
export async function findSessionUser(token: string): Promise<SessionUser | null> {
  const [row] = await getDb()
    .select({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await getDb()
    .delete(sessions)
    .where(eq(sessions.tokenHash, hashToken(token)));
}

export async function deleteExpiredSessions(): Promise<void> {
  await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
