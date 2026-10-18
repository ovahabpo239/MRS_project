"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { resendVerificationAction } from "../actions";
import { idle, type FormState } from "../form-state";

/** "Send me a new confirmation link" for a known address. The server answers the same either way. */
export function ResendForm({ email }: { email: string }) {
  const [state, action] = useActionState<FormState, FormData>(resendVerificationAction, idle);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="email" value={email} />
      {state.status === "success" && (
        <Alert tone="success">If that account needs confirming, a new link is on its way.</Alert>
      )}
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <SubmitButton variant="outline" pendingLabel="Sending…">
        Resend confirmation email
      </SubmitButton>
    </form>
  );
}
