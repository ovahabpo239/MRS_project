import { Download, Mail, MapPin } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cv } from "../cv";

export function AboutHeader({ cvHref }: { cvHref?: string }) {
  const { links } = siteConfig;
  return (
    <header className="space-y-8">
      <div className="space-y-3">
        <p className="font-code-sm text-code-sm text-primary">about_me</p>
        <h1 className="font-headline-xl-mobile text-headline-xl-mobile text-on-surface md:font-headline-xl md:text-headline-xl">
          {siteConfig.fullName}
        </h1>
        <p className="font-headline-md text-headline-md text-primary">{cv.title}</p>
        <p className="flex items-center gap-2 font-code-sm text-code-sm text-on-surface-variant">
          <MapPin className="size-4" aria-hidden="true" />
          {cv.location}
        </p>
      </div>
      <p className="max-w-3xl font-body-lg text-body-lg text-on-surface-variant">{cv.summary}</p>
      <div className="flex flex-wrap gap-4">
        {cvHref && (
          <ButtonLink href={cvHref} variant="shimmer" download>
            <Download className="size-4" aria-hidden="true" />
            Download CV
          </ButtonLink>
        )}
        <ButtonLink href={`mailto:${siteConfig.email}`} variant="solid">
          <Mail className="size-4" aria-hidden="true" />
          Email me
        </ButtonLink>
        <ButtonLink href={links.github} variant="outline">
          GitHub
        </ButtonLink>
        {links.linkedin && (
          <ButtonLink href={links.linkedin} variant="outline">
            LinkedIn
          </ButtonLink>
        )}
        {links.instagram && (
          <ButtonLink href={links.instagram} variant="outline">
            Instagram
          </ButtonLink>
        )}
      </div>
    </header>
  );
}
