export type FieldName = "email" | "password" | "newPassword" | "confirmPassword";

/** Shape returned by every auth server action and consumed by `useActionState` in the forms. */
export type FormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<FieldName, string>>;
      /** Lets the login form offer a "resend confirmation" action. */
      code?: "email_not_verified";
      /** Echoed back because React resets uncontrolled inputs after an action. Never a password. */
      email?: string;
    }
  | { status: "success"; email?: string };

export const idle: FormState = { status: "idle" };
