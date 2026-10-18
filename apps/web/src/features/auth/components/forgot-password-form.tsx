"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { forgotPasswordAction } from "../actions";
import { idle, type FormState } from "../form-state";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(forgotPasswordAction, idle);

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <Alert tone="success">
          If an account exists for <strong>{state.email}</strong>, we have sent a link to choose a
          new password. It is valid for 1 hour.
        </Alert>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Nothing after a few minutes? Check your spam folder, or try again.
        </p>
        <Link href="/login" className="inline-block text-primary underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    );
  }

  const error = state.status === "error" ? state : undefined;
  return (
    <form action={action} className="space-y-5" noValidate>
      {error && !error.fieldErrors && <Alert tone="error">{error.message}</Alert>}
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        defaultValue={error?.email}
        error={error?.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Sending…" className="w-full">
        Send reset link
      </SubmitButton>
    </form>
  );
}
