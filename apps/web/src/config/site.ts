/** Site-wide constants. Edit this file to rebrand; nothing else hard-codes these strings. */
export interface SiteConfig {
  name: string;
  shortName: string;
  description: string;
  /** First name, used in headings. */
  author: string;
  /** Full name, used on the About page. */
  fullName: string;
  email: string;
  /** Linked from the hero. */
  github: string;
  /** Profiles listed in the footer and on the About page, in this order. */
  social: readonly { label: string; href: string }[];
  /** File name of the CV PDF in `public/`. The download button only shows if the file exists. */
  cvFile: string;
  /** Technologies that actually back the projects in this repository. */
  stack: readonly string[];
}

const github = "https://github.com/ovahabpo239";

export const siteConfig: SiteConfig = {
  name: "Alex Projects",
  shortName: "ALEX_PROJECTS",
  description:
    "A hub for the projects I build. Browse what is live, sign up, and try them out yourself.",
  author: "Alex",
  fullName: "Oleksandr Vahabov",
  email: "alexandervahabov@gmail.com",
  github,
  social: [
    { label: "GitHub", href: github },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/alexander-vahabov-615334373" },
    { label: "Instagram", href: "https://www.instagram.com/buzzardd239/" },
  ],
  cvFile: "Oleksandr_Vahabov_CV.pdf",
  stack: ["TypeScript", "Python", "PostgreSQL", "Docker"],
};
