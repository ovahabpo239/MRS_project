import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  loginSchema,
  PASSWORD_MAX,
  PASSWORD_MIN,
  registerSchema,
  resetPasswordSchema,
} from "@/features/auth/schemas";

const strong = "x".repeat(PASSWORD_MIN);

describe("registerSchema", () => {
  it("normalises the email to trimmed lowercase", () => {
    const result = registerSchema.parse({ email: "  Alex@Example.COM ", password: strong });
    expect(result.email).toBe("alex@example.com");
  });

  it.each(["", "not-an-email", "a@b", "@example.com"])("rejects email %j", (email) => {
    expect(registerSchema.safeParse({ email, password: strong }).success).toBe(false);
  });

  it("enforces password length bounds", () => {
    const email = "a@example.com";
    expect(
      registerSchema.safeParse({ email, password: "x".repeat(PASSWORD_MIN - 1) }).success,
    ).toBe(false);
    expect(registerSchema.safeParse({ email, password: strong }).success).toBe(true);
    expect(
      registerSchema.safeParse({ email, password: "x".repeat(PASSWORD_MAX + 1) }).success,
    ).toBe(false);
  });
});

describe("loginSchema", () => {
  it("does not apply the registration password policy", () => {
    expect(loginSchema.safeParse({ email: "a@example.com", password: "short" }).success).toBe(true);
  });

  it("still requires a password", () => {
    expect(loginSchema.safeParse({ email: "a@example.com", password: "" }).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("normalises the email and rejects invalid ones", () => {
    expect(forgotPasswordSchema.parse({ email: " Alex@Example.COM " }).email).toBe(
      "alex@example.com",
    );
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  const token = "t".repeat(43);
  const valid = {
    token,
    newPassword: "a-brand-new-password",
    confirmPassword: "a-brand-new-password",
  };

  it("accepts a valid reset", () => {
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("enforces the password policy and the confirmation", () => {
    expect(
      resetPasswordSchema.safeParse({ ...valid, newPassword: "short", confirmPassword: "short" })
        .success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ ...valid, confirmPassword: "different-password" }).success,
    ).toBe(false);
  });

  it("rejects a missing or implausible token", () => {
    expect(resetPasswordSchema.safeParse({ ...valid, token: "" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ ...valid, token: "short" }).success).toBe(false);
  });
});
