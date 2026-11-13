import "server-only";
import { getEnv } from "@/lib/env";
import { err, ok, type Result } from "@/lib/result";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/server/auth/password";
import { deleteExpiredSessions } from "@/server/auth/session-store";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { sendMail } from "@/server/mail/send";
import { consume, type RateLimit } from "@/server/security/rate-limit";
import {
  alreadyRegisteredEmail,
  passwordChangedEmail,
  passwordResetEmail,
  verificationEmail,
} from "./emails";
import {
  findUserByEmail,
  insertUser,
  markEmailVerified,
  redeemVerificationToken,
  replacePasswordResetToken,
  replaceVerificationToken,
  resetPasswordWithToken,
} from "./repository";
import type { LoginInput, RegisterInput } from "./schemas";

export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

// Per-email limits also stop the forms being used to flood someone's inbox.
const LIMITS: Record<
  "register" | "login" | "resend" | "forgot",
  { email: RateLimit; ip?: RateLimit }
> = {
  register: { email: { limit: 3, windowSeconds: 3600 }, ip: { limit: 10, windowSeconds: 3600 } },
  login: { email: { limit: 10, windowSeconds: 900 }, ip: { limit: 30, windowSeconds: 900 } },
  resend: { email: { limit: 3, windowSeconds: 3600 } },
  forgot: { email: { limit: 3, windowSeconds: 3600 }, ip: { limit: 10, windowSeconds: 3600 } },
};

/** `ip` is undefined when it cannot be determined; IP limits are skipped then, email limits remain. */
export type RequestContext = { ip?: string };

async function withinLimits(
  action: keyof typeof LIMITS,
  email: string,
  ip?: string,
): Promise<boolean> {
  const limits = LIMITS[action];
  const checks = [consume(`${action}:email:${email}`, limits.email)];
  if (ip && limits.ip) checks.push(consume(`${action}:ip:${ip}`, limits.ip));
  // Evaluate all, so every attempt is counted even if an earlier check already failed.
  return (await Promise.all(checks)).every(Boolean);
}

function url(path: string): string {
  return new URL(path, getEnv().SITE_URL).toString();
}

async function issueVerification(userId: string, email: string): Promise<void> {
  const token = generateToken();
  await replaceVerificationToken(
    userId,
    hashToken(token),
    new Date(Date.now() + VERIFICATION_TTL_MS),
  );
  await sendMail({ to: email, ...verificationEmail(url(`/verify-email?token=${token}`)) });
}

/** Mail problems must not change the response, or the form would reveal which emails exist. */
async function safely(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    console.error(
      JSON.stringify({ level: "error", msg: "email delivery failed", error: String(error) }),
    );
  }
}

/**
 * Create an account and email a confirmation link. The outcome is identical whether or not the
 * address was already registered (anti-enumeration): existing owners get an email instead.
 */
export async function register(
  input: RegisterInput,
  ctx: RequestContext = {},
): Promise<Result<void, "rate_limited">> {
  if (!(await withinLimits("register", input.email, ctx.ip))) return err("rate_limited");

  // Hash before looking the user up so both paths take the same time.
  const passwordHash = await hashPassword(input.password);
  const created = await insertUser(input.email, passwordHash);

  if (created) {
    await safely(() => issueVerification(created.id, created.email));
    return ok(undefined);
  }

  const existing = await findUserByEmail(input.email);
  if (existing && !existing.emailVerifiedAt) {
    await safely(() => issueVerification(existing.id, existing.email));
  } else if (existing) {
    await safely(() => sendMail({ to: existing.email, ...alreadyRegisteredEmail(url("/login")) }));
  }
  return ok(undefined);
}

export type LoginError = "invalid_credentials" | "email_not_verified" | "rate_limited";

/** Check credentials. Returns the user id; the caller (action) starts the session. */
export async function login(
  input: LoginInput,
  ctx: RequestContext = {},
): Promise<Result<{ userId: string }, LoginError>> {
  if (!(await withinLimits("login", input.email, ctx.ip))) return err("rate_limited");

  const user = await findUserByEmail(input.email);
  if (!user) {
    await verifyAgainstDummy(input.password);
    return err("invalid_credentials");
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) return err("invalid_credentials");

  // Only revealed after the password is proven correct, so it leaks nothing to guessers.
  if (!user.emailVerifiedAt) return err("email_not_verified");

  void deleteExpiredSessions().catch(() => undefined);
  return ok({ userId: user.id });
}

/** Redeem an emailed token and mark the address as verified. */
export async function verifyEmail(token: string): Promise<Result<void, "invalid_or_expired">> {
  const userId = await redeemVerificationToken(hashToken(token));
  if (!userId) return err("invalid_or_expired");
  await markEmailVerified(userId);
  return ok(undefined);
}

/** Re-send the confirmation link. Same response whether or not the account exists. */
export async function resendVerification(email: string): Promise<Result<void, "rate_limited">> {
  if (!(await withinLimits("resend", email))) return err("rate_limited");
  const user = await findUserByEmail(email);
  if (user && !user.emailVerifiedAt) await safely(() => issueVerification(user.id, user.email));
  return ok(undefined);
}

/**
 * Start a password reset: email a one-hour, single-use link if the account exists. The answer is
 * the same for unknown addresses, and the mail is sent in the background so response time does
 * not reveal whether an account exists (this server is long-running, so the task completes).
 */
export async function requestPasswordReset(
  email: string,
  ctx: RequestContext = {},
): Promise<Result<void, "rate_limited">> {
  if (!(await withinLimits("forgot", email, ctx.ip))) return err("rate_limited");

  const user = await findUserByEmail(email);
  if (user) {
    void safely(async () => {
      const token = generateToken();
      await replacePasswordResetToken(
        user.id,
        hashToken(token),
        new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      );
      await sendMail({
        to: user.email,
        ...passwordResetEmail(url(`/reset-password?token=${token}`)),
      });
    });
  }
  return ok(undefined);
}

/**
 * Finish a password reset with the emailed token. Signs the account out everywhere and counts the
 * address as verified, since reading the email proves control of it.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<Result<void, "invalid_or_expired">> {
  const reset = await resetPasswordWithToken(hashToken(token), await hashPassword(newPassword));
  if (!reset) return err("invalid_or_expired");
  await safely(() => sendMail({ to: reset.email, ...passwordChangedEmail() }));
  return ok(undefined);
}
