"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/urls";
import { endSession, startSession } from "@/server/auth/session";
import type { FieldName, FormState } from "./form-state";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendSchema,
  resetPasswordSchema,
  tokenSchema,
} from "./schemas";
import * as auth from "./service";

const RATE_LIMITED = "Too many attempts. Please wait a while and try again.";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** First message per field, for the field names the forms know about. */
function firstErrors(error: z.ZodError): Partial<Record<FieldName, string>> {
  const fields = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const names: FieldName[] = ["email", "password", "newPassword", "confirmPassword"];
  const first: Partial<Record<FieldName, string>> = {};
  for (const name of names) {
    const message = fields[name]?.[0];
    if (message) first[name] = message;
  }
  return first;
}

/**
 * Client address for rate limiting. Only meaningful behind a reverse proxy that overwrites
 * X-Forwarded-For; without one the IP limit is skipped and per-email limits still apply.
 */
async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    email: text(formData, "email"),
    password: text(formData, "password"),
  });
  const email = text(formData, "email").trim();
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: firstErrors(parsed.error),
      email,
    };
  }

  const result = await auth.register(parsed.data, { ip: await clientIp() });
  if (!result.ok) return { status: "error", message: RATE_LIMITED, email };
  return { status: "success", email: parsed.data.email };
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email").trim();
  const parsed = loginSchema.safeParse({ email, password: text(formData, "password") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: firstErrors(parsed.error),
      email,
    };
  }

  const result = await auth.login(parsed.data, { ip: await clientIp() });
  if (!result.ok) {
    switch (result.error) {
      case "rate_limited":
        return { status: "error", message: RATE_LIMITED, email };
      case "email_not_verified":
        return {
          status: "error",
          code: "email_not_verified",
          message:
            "Please confirm your email address first. We sent you a link when you signed up.",
          email: parsed.data.email,
        };
      case "invalid_credentials":
        return { status: "error", message: "Incorrect email or password.", email };
    }
  }

  await startSession(result.value.userId);
  // redirect() works by throwing, so it must stay outside any try/catch.
  redirect(safeNextPath(formData.get("next"), "/"));
}

export async function verifyEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = tokenSchema.safeParse({ token: text(formData, "token") });
  if (!parsed.success) {
    return { status: "error", message: "This confirmation link is not valid." };
  }
  const result = await auth.verifyEmail(parsed.data.token);
  if (!result.ok) {
    return {
      status: "error",
      message: "This link is invalid or has expired. Request a new one from the sign-in page.",
    };
  }
  return { status: "success" };
}

export async function resendVerificationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resendSchema.safeParse({ email: text(formData, "email") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid email address.",
      fieldErrors: firstErrors(parsed.error),
    };
  }
  const result = await auth.resendVerification(parsed.data.email);
  if (!result.ok) return { status: "error", message: RATE_LIMITED, email: parsed.data.email };
  return { status: "success", email: parsed.data.email };
}

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = text(formData, "email").trim();
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid email address.",
      fieldErrors: firstErrors(parsed.error),
      email,
    };
  }

  const result = await auth.requestPasswordReset(parsed.data.email, { ip: await clientIp() });
  if (!result.ok) return { status: "error", message: RATE_LIMITED, email };
  // Identical for known and unknown addresses.
  return { status: "success", email: parsed.data.email };
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: text(formData, "token"),
    newPassword: text(formData, "newPassword"),
    confirmPassword: text(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors = firstErrors(parsed.error);
    return Object.keys(fieldErrors).length > 0
      ? { status: "error", message: "Please fix the highlighted fields.", fieldErrors }
      : { status: "error", message: "This reset link is not valid." };
  }

  const result = await auth.resetPassword(parsed.data.token, parsed.data.newPassword);
  if (!result.ok) {
    return {
      status: "error",
      message: "This link is invalid or has expired. Request a new one to try again.",
    };
  }
  return { status: "success" };
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}
