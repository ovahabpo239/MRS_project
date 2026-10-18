import { siteConfig } from "@/config/site";

const footerLinks = [
  { label: "Github", href: siteConfig.links.github },
  ...(siteConfig.links.linkedin ? [{ label: "LinkedIn", href: siteConfig.links.linkedin }] : []),
  ...(siteConfig.links.instagram ? [{ label: "Instagram", href: siteConfig.links.instagram }] : []),
  { label: "Email", href: `mailto:${siteConfig.email}` },
];

export function Footer() {
  return (
    <footer className="w-full border-t border-white/5 bg-surface-container-lowest py-12">
      <div className="mx-auto flex max-w-container-max flex-col items-center justify-between gap-gutter px-margin-mobile md:flex-row md:px-margin-desktop">
        <div className="text-center md:text-left">
          <p className="mb-2 font-headline-md text-headline-md text-on-surface">
            {siteConfig.shortName}
          </p>
          <p className="font-body-md text-body-md text-on-surface-variant">
            © {new Date().getFullYear()} {siteConfig.author}. Based on a free HTML template by{" "}
            <a
              href="https://templatesjungle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-primary"
            >
              TemplatesJungle.com
            </a>
            .
          </p>
        </div>
        <ul className="flex gap-8">
          {footerLinks.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-label-caps text-label-caps text-on-surface-variant transition-all hover:-translate-y-0.5 hover:text-secondary"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
