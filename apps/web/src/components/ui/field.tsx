import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Props = Omit<ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
};

/** Labelled input with an accessible error and hint (linked via aria-describedby). */
export function Field({ id, label, error, hint, className, ...input }: Props) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block font-label-caps text-label-caps text-on-surface-variant">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "w-full rounded-lg border bg-surface-container-lowest px-4 py-3 font-body-md text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:ring-primary",
          error ? "border-error" : "border-white/15",
          className,
        )}
        {...input}
      />
      {hint && !error && (
        <p id={hintId} className="font-code-sm text-code-sm text-on-surface-variant">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="font-code-sm text-code-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
