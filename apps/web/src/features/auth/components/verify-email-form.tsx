"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { buttonStyles } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { verifyEmailAction } from "../actions";
import { idle, type FormState } from "../form-state";

/**
 * Confirmation needs a click instead of happening on page load: mail scanners and link
 * previews fetch URLs automatically and would otherwise burn the single-use token.
 */
export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(verifyEmailAction, idle);

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <Alert tone="success">Your email is confirmed. You can sign in now.</Alert>
        <Link href="/login" className={buttonStyles({ variant: "shimmer", className: "w-full" })}>
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <SubmitButton pendingLabel="Confirming…" className="w-full">
        Confirm my email
      </SubmitButton>
    </form>
  );
}
