import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { primaryNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";

export function Header() {
  const cta = (
    <ButtonLink href={siteConfig.links.github} variant="shimmer" size="sm">
      GitHub
    </ButtonLink>
  );

  return (
    <header className="fixed top-0 z-50 w-full border-b border-on-surface/10 bg-surface/60 backdrop-blur-[24px]">
      <div className="mx-auto flex h-20 max-w-container-max items-center justify-between px-margin-mobile md:px-margin-desktop">
        <Link
          href="/"
          className="font-headline-md text-headline-md font-black tracking-tighter text-primary transition-opacity hover:opacity-80"
        >
          {siteConfig.shortName}
        </Link>
        <NavLinks
          items={primaryNav}
          className="hidden items-center gap-8 md:flex"
          linkClassName="font-label-caps text-label-caps"
        />
        <div className="hidden md:block">{cta}</div>
        <MobileMenu items={primaryNav} brand={siteConfig.shortName}>
          {cta}
        </MobileMenu>
      </div>
    </header>
  );
}
