"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "./button";

/** Submit button that disables itself and shows progress while its form action runs. */
export function SubmitButton({
  children,
  pendingLabel = "Please wait…",
  variant = "shimmer",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      aria-disabled={pending}
      className={className}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
