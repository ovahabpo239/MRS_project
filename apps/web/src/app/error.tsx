"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-container-max flex-col items-start justify-center gap-6 px-margin-mobile md:px-margin-desktop">
      <p className="font-code-sm text-code-sm text-error">something went wrong</p>
      <h1 className="font-headline-xl-mobile text-headline-xl-mobile text-on-surface md:font-headline-xl md:text-headline-xl">
        Unexpected error
      </h1>
      <p className="max-w-xl font-body-lg text-body-lg text-on-surface-variant">
        The page failed to load. You can try again.
      </p>
      <Button onClick={reset} variant="solid">
        Try again
      </Button>
    </div>
  );
}
