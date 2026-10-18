"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { registerAction } from "../actions";
import { idle, type FormState } from "../form-state";
import { PASSWORD_MIN } from "../schemas";
import { ResendForm } from "./resend-form";

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(registerAction, idle);

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <Alert tone="success">
          Check your inbox. If <strong>{state.email}</strong> can be registered, we have sent a
          confirmation link. It is valid for 24 hours.
        </Alert>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Nothing arrived after a few minutes? Check your spam folder or request a new link.
        </p>
        {state.email && <ResendForm email={state.email} />}
        <Link href="/login" className="inline-block text-primary underline underline-offset-4">
          Go to sign in
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
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        hint={`At least ${PASSWORD_MIN} characters.`}
        error={error?.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Creating account…" className="w-full">
        Create account
      </SubmitButton>
    </form>
  );
}
