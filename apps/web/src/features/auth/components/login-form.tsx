"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction } from "../actions";
import { idle, type FormState } from "../form-state";
import { ResendForm } from "./resend-form";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, idle);
  const error = state.status === "error" ? state : undefined;

  return (
    <div className="space-y-5">
      {notice && !error && <Alert tone="success">{notice}</Alert>}
      <form action={action} className="space-y-5" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
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
        <div className="space-y-2">
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            error={error?.fieldErrors?.password}
          />
          <Link
            href="/forgot-password"
            className="inline-block font-code-sm text-code-sm text-primary underline underline-offset-4"
          >
            Forgot password?
          </Link>
        </div>
        <SubmitButton pendingLabel="Signing in…" className="w-full">
          Sign in
        </SubmitButton>
      </form>
      {error?.code === "email_not_verified" && error.email && <ResendForm email={error.email} />}
    </div>
  );
}
