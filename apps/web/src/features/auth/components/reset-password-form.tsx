"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { buttonStyles } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { resetPasswordAction } from "../actions";
import { idle, type FormState } from "../form-state";
import { PASSWORD_MIN } from "../schemas";

/** The token only travels in a hidden field of this POST, never in the page's own requests. */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetPasswordAction, idle);

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <Alert tone="success">
          Your password has been changed and you were signed out everywhere. Sign in with the new
          one.
        </Alert>
        <Link href="/login" className={buttonStyles({ variant: "shimmer", className: "w-full" })}>
          Go to sign in
        </Link>
      </div>
    );
  }

  const error = state.status === "error" ? state : undefined;
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      {error && !error.fieldErrors && (
        <div className="space-y-3">
          <Alert tone="error">{error.message}</Alert>
          <Link
            href="/forgot-password"
            className="inline-block text-primary underline underline-offset-4"
          >
            Request a new link
          </Link>
        </div>
      )}
      <Field
        id="newPassword"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        hint={`At least ${PASSWORD_MIN} characters.`}
        error={error?.fieldErrors?.newPassword}
      />
      <Field
        id="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        error={error?.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingLabel="Saving…" className="w-full">
        Set new password
      </SubmitButton>
    </form>
  );
}
