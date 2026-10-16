import { Reveal } from "./reveal";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export function CtaBanner() {
  return (
    <Reveal className="mx-auto max-w-container-max px-margin-mobile py-section-gap text-center md:px-margin-desktop">
      <div className="glass-card group relative overflow-hidden rounded-2xl p-12 md:p-24">
        <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-primary via-secondary to-primary transition-all group-hover:h-2" />
        <h2 className="mb-8 font-headline-xl-mobile text-headline-xl-mobile text-on-surface md:font-headline-xl md:text-headline-xl">
          Ready to try it?
        </h2>
        <p className="mx-auto mb-12 max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
          Have a look at what is live and what is coming next. The code for everything is open.
        </p>
        <div className="flex flex-col justify-center gap-6 md:flex-row">
          <ButtonLink href="/projects" variant="shimmer" size="lg">
            See all projects
          </ButtonLink>
          <ButtonLink href={siteConfig.links.github} variant="muted" size="lg">
            View source
          </ButtonLink>
        </div>
      </div>
    </Reveal>
  );
}
