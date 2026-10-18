import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  users,
  type User,
} from "@/server/db/schema";

/** Replace any outstanding reset token for the user, so only the newest link works. */
export async function replacePasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await tx.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
  });
}

/**
 * Redeem a reset token and set the new password, all in one transaction: the token is consumed
 * (single use, even under races), the password is replaced, the address counts as verified
 * (the user just proved they control it), every session on every device is revoked and any other
 * outstanding reset link is dropped. Returns undefined if the token is unknown or expired.
 */
export async function resetPasswordWithToken(
  tokenHash: string,
  passwordHash: string,
): Promise<{ userId: string; email: string } | undefined> {
  return getDb().transaction(async (tx) => {
    const [token] = await tx
      .delete(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: passwordResetTokens.userId });
    if (!token) return undefined;

    const [user] = await tx
      .update(users)
      .set({
        passwordHash,
        emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`,
      })
      .where(eq(users.id, token.userId))
      .returning({ userId: users.id, email: users.email });

    await tx.delete(sessions).where(eq(sessions.userId, token.userId));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, token.userId));
    return user;
  });
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  return user;
}

/** Insert a user, or return undefined if the email is already registered (race-safe). */
export async function insertUser(email: string, passwordHash: string): Promise<User | undefined> {
  const [user] = await getDb()
    .insert(users)
    .values({ email, passwordHash })
    .onConflictDoNothing({ target: users.email })
    .returning();
  return user;
}

export async function markEmailVerified(userId: string): Promise<void> {
  await getDb().update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
}

/** Replace any outstanding token for the user, so only the newest link works. */
export async function replaceVerificationToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
    await tx.insert(emailVerificationTokens).values({ userId, tokenHash, expiresAt });
  });
}

/**
 * Atomically redeem a token: deleting and returning in one statement makes it single-use even
 * if two requests race. Returns the owning user id, or undefined if unknown or expired.
 */
export async function redeemVerificationToken(tokenHash: string): Promise<string | undefined> {
  const [row] = await getDb()
    .delete(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        gt(emailVerificationTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: emailVerificationTokens.userId });
  return row?.userId;
}
