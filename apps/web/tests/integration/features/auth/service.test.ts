import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { sendMail, type Mail } from "@/server/mail/send";
import {
  findUserByEmail,
  replacePasswordResetToken,
  replaceVerificationToken,
} from "@/features/auth/repository";
import {
  login,
  register,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "@/features/auth/service";
import { findSessionUser, insertSession } from "@/server/auth/session-store";
import { resetDatabase } from "@tests/support/db";

vi.mock("@/server/mail/send", () => ({ sendMail: vi.fn() }));

const send = vi.mocked(sendMail);
const sent = (): Mail[] => send.mock.calls.map(([mail]) => mail);
const email = "alex@example.com";
const password = "correct horse battery";

/** Pull the confirmation token out of the most recent email, like a user clicking the link. */
function lastToken(): string {
  const mail = sent().at(-1);
  const match = mail?.text.match(/verify-email\?token=([\w-]+)/);
  if (!match?.[1]) throw new Error(`no verification link in: ${mail?.text}`);
  return match[1];
}

async function registerAndVerify(): Promise<void> {
  await register({ email, password });
  const result = await verifyEmail(lastToken());
  expect(result.ok).toBe(true);
}

beforeEach(async () => {
  await resetDatabase();
  send.mockReset();
  send.mockResolvedValue(undefined);
});

describe("register", () => {
  it("creates an unverified user with an argon2id hash and emails a confirmation link", async () => {
    expect((await register({ email, password })).ok).toBe(true);

    const user = await findUserByEmail(email);
    expect(user?.emailVerifiedAt).toBeNull();
    expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user?.passwordHash).not.toContain(password);

    expect(sent()).toHaveLength(1);
    expect(sent()[0]?.to).toBe(email);
    expect(sent()[0]?.text).toContain("http://localhost:5003/verify-email?token=");
  });

  it("answers identically for a verified address and emails the owner instead", async () => {
    await registerAndVerify();
    send.mockClear();

    expect((await register({ email, password: "another password 123" })).ok).toBe(true);

    expect(await getDb().select().from(users)).toHaveLength(1);
    expect(sent()).toHaveLength(1);
    expect(sent()[0]?.subject).toMatch(/already have an account/i);
    // The original password still works: the second attempt did not overwrite it.
    expect((await login({ email, password })).ok).toBe(true);
  });

  it("re-sends a fresh link for an unverified address and invalidates the old one", async () => {
    await register({ email, password });
    const first = lastToken();
    await register({ email, password });
    const second = lastToken();

    expect(second).not.toBe(first);
    expect(await verifyEmail(first)).toEqual({ ok: false, error: "invalid_or_expired" });
    expect((await verifyEmail(second)).ok).toBe(true);
  });

  it("still succeeds when the mail server is down", async () => {
    send.mockRejectedValue(new Error("smtp down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await register({ email, password })).ok).toBe(true);
    expect(await findUserByEmail(email)).toBeDefined();
  });

  it("limits registrations per email address", async () => {
    for (let i = 0; i < 3; i++) expect((await register({ email, password })).ok).toBe(true);
    expect(await register({ email, password })).toEqual({ ok: false, error: "rate_limited" });
  });
});

describe("verifyEmail", () => {
  it("marks the address verified and the token is single use", async () => {
    await register({ email, password });
    const token = lastToken();

    expect((await verifyEmail(token)).ok).toBe(true);
    expect((await findUserByEmail(email))?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(await verifyEmail(token)).toEqual({ ok: false, error: "invalid_or_expired" });
  });

  it("rejects unknown and expired tokens", async () => {
    expect(await verifyEmail(generateToken())).toEqual({ ok: false, error: "invalid_or_expired" });

    await register({ email, password });
    const user = await findUserByEmail(email);
    const expired = generateToken();
    await replaceVerificationToken(user!.id, hashToken(expired), new Date(Date.now() - 1000));
    expect(await verifyEmail(expired)).toEqual({ ok: false, error: "invalid_or_expired" });
    expect((await findUserByEmail(email))?.emailVerifiedAt).toBeNull();
  });
});

describe("login", () => {
  it("refuses an unverified account only after the password is proven correct", async () => {
    await register({ email, password });

    expect(await login({ email, password })).toEqual({ ok: false, error: "email_not_verified" });
    // A wrong password must not reveal that the account exists or is unverified.
    expect(await login({ email, password: "wrong password!" })).toEqual({
      ok: false,
      error: "invalid_credentials",
    });
  });

  it("returns the same error for an unknown email as for a wrong password", async () => {
    await registerAndVerify();
    const unknown = await login({ email: "nobody@example.com", password });
    const wrong = await login({ email, password: "wrong password!" });
    expect(unknown).toEqual(wrong);
    expect(unknown).toEqual({ ok: false, error: "invalid_credentials" });
  });

  it("succeeds with the right credentials once verified", async () => {
    await registerAndVerify();
    const user = await findUserByEmail(email);
    expect(await login({ email, password })).toEqual({ ok: true, value: { userId: user!.id } });
  });

  it("throttles repeated attempts per email", async () => {
    await registerAndVerify();
    for (let i = 0; i < 10; i++) await login({ email, password: "wrong password!" });
    // Even the correct password is refused while the limit is exceeded.
    expect(await login({ email, password })).toEqual({ ok: false, error: "rate_limited" });
  });
});

describe("resendVerification", () => {
  it("sends a link for an unverified account and nothing for unknown or verified ones", async () => {
    await register({ email, password });
    send.mockClear();

    expect((await resendVerification(email)).ok).toBe(true);
    expect(sent()).toHaveLength(1);

    expect((await resendVerification("nobody@example.com")).ok).toBe(true);
    expect(sent()).toHaveLength(1);

    expect((await verifyEmail(lastToken())).ok).toBe(true);
    expect((await resendVerification(email)).ok).toBe(true);
    expect(sent()).toHaveLength(1);
  });

  it("is limited per email address", async () => {
    await register({ email, password });
    for (let i = 0; i < 3; i++) expect((await resendVerification(email)).ok).toBe(true);
    expect(await resendVerification(email)).toEqual({ ok: false, error: "rate_limited" });
  });
});

describe("password reset", () => {
  const newPassword = "a-brand-new-password";

  /** The reset mail is sent in the background, so wait for it to arrive. */
  async function requestAndGetToken(): Promise<string> {
    const before = sent().length;
    expect((await requestPasswordReset(email)).ok).toBe(true);
    await vi.waitFor(() => expect(sent()).toHaveLength(before + 1));
    const match = sent()
      .at(-1)
      ?.text.match(/reset-password\?token=([\w-]+)/);
    if (!match?.[1]) throw new Error(`no reset link in: ${sent().at(-1)?.text}`);
    return match[1];
  }

  it("emails a reset link to an existing account", async () => {
    await registerAndVerify();
    send.mockClear();

    await requestAndGetToken();

    expect(sent()[0]).toMatchObject({ to: email });
    expect(sent()[0]?.subject).toMatch(/reset your/i);
    expect(sent()[0]?.text).toContain("http://localhost:5003/reset-password?token=");
  });

  it("answers the same for an unknown address and sends nothing", async () => {
    await registerAndVerify();
    send.mockClear();

    expect((await requestPasswordReset("nobody@example.com")).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(sent()).toHaveLength(0);
  });

  it("sets the new password, revokes every session and notifies the owner", async () => {
    await registerAndVerify();
    const user = (await findUserByEmail(email))!;
    const a = await insertSession(user.id);
    const b = await insertSession(user.id);
    const token = await requestAndGetToken();
    send.mockClear();

    expect((await resetPassword(token, newPassword)).ok).toBe(true);

    expect(await login({ email, password })).toEqual({ ok: false, error: "invalid_credentials" });
    expect((await login({ email, password: newPassword })).ok).toBe(true);
    expect(await findSessionUser(a.token)).toBeNull();
    expect(await findSessionUser(b.token)).toBeNull();
    expect(sent()).toHaveLength(1);
    expect(sent()[0]?.subject).toMatch(/password was changed/i);
  });

  it("works only once", async () => {
    await registerAndVerify();
    const token = await requestAndGetToken();

    expect((await resetPassword(token, newPassword)).ok).toBe(true);
    expect(await resetPassword(token, "yet-another-password")).toEqual({
      ok: false,
      error: "invalid_or_expired",
    });
    expect((await login({ email, password: newPassword })).ok).toBe(true);
  });

  it("rejects unknown and expired tokens and leaves the password alone", async () => {
    await registerAndVerify();
    expect(await resetPassword(generateToken(), newPassword)).toEqual({
      ok: false,
      error: "invalid_or_expired",
    });

    const user = (await findUserByEmail(email))!;
    const expired = generateToken();
    await replacePasswordResetToken(user.id, hashToken(expired), new Date(Date.now() - 1000));
    expect(await resetPassword(expired, newPassword)).toEqual({
      ok: false,
      error: "invalid_or_expired",
    });
    expect((await login({ email, password })).ok).toBe(true);
  });

  it("only the newest link works", async () => {
    await registerAndVerify();
    const first = await requestAndGetToken();
    const second = await requestAndGetToken();

    expect(second).not.toBe(first);
    expect(await resetPassword(first, newPassword)).toEqual({
      ok: false,
      error: "invalid_or_expired",
    });
    expect((await resetPassword(second, newPassword)).ok).toBe(true);
  });

  it("confirms an unverified address, because reading the email proves control of it", async () => {
    await register({ email, password });
    expect((await findUserByEmail(email))?.emailVerifiedAt).toBeNull();
    const token = await requestAndGetToken();

    expect((await resetPassword(token, newPassword)).ok).toBe(true);

    expect((await findUserByEmail(email))?.emailVerifiedAt).toBeInstanceOf(Date);
    expect((await login({ email, password: newPassword })).ok).toBe(true);
  });

  it("is limited per email address", async () => {
    await registerAndVerify();
    for (let i = 0; i < 3; i++) expect((await requestPasswordReset(email)).ok).toBe(true);
    expect(await requestPasswordReset(email)).toEqual({ ok: false, error: "rate_limited" });
  });

  it("does not fail the request when the mail server is down", async () => {
    await registerAndVerify();
    send.mockRejectedValue(new Error("smtp down"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect((await requestPasswordReset(email)).ok).toBe(true);
    await vi.waitFor(() => expect(errors).toHaveBeenCalled());
  });
});

it("keeps users table free of duplicate emails under concurrent registration", async () => {
  await Promise.all([
    register({ email, password }),
    register({ email, password }),
    register({ email, password }),
  ]);
  const rows = await getDb().select().from(users).where(eq(users.email, email));
  expect(rows).toHaveLength(1);
});
