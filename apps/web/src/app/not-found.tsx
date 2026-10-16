import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-container-max flex-col items-start justify-center gap-6 px-margin-mobile md:px-margin-desktop">
      <p className="font-code-sm text-code-sm text-primary">error 404</p>
      <h1 className="font-headline-xl-mobile text-headline-xl-mobile text-on-surface md:font-headline-xl md:text-headline-xl">
        Page not found
      </h1>
      <p className="max-w-xl font-body-lg text-body-lg text-on-surface-variant">
        That page does not exist or has moved.
      </p>
      <ButtonLink href="/" variant="solid">
        Back home
      </ButtonLink>
    </div>
  );
}
