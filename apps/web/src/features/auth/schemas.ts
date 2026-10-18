import { z } from "zod";

/** Emails are compared case-insensitively, so they are stored trimmed and lowercase. */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254, "That email address is too long."));

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

const newPassword = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`);

export const registerSchema = z.object({ email, password: newPassword });

// Login does not enforce password rules: they apply when choosing a password, and checking
// them here would only tell an attacker about the policy.
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX),
});

export const resendSchema = z.object({ email });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords do not match.",
  });

export const tokenSchema = z.object({ token: z.string().min(20).max(200) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
