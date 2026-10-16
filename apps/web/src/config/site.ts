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
  links: {
    github: string;
    linkedin?: string;
    instagram?: string;
  };
  /** File name of the CV PDF in `public/`. The download button only shows if the file exists. */
  cvFile: string;
  /** Technologies that actually back the projects in this repository. */
  stack: readonly string[];
}

export const siteConfig: SiteConfig = {
  name: "Alex Projects",
  shortName: "ALEX_PROJECTS",
  description:
    "A hub for the projects I build. Browse what is live, sign up, and try them out yourself.",
  author: "Alex",
  fullName: "Oleksandr Vahabov",
  email: "alexandervahabov@gmail.com",
  links: {
    github: "https://github.com/ovahabpo239",
    linkedin: "https://www.linkedin.com/in/alexander-vahabov-615334373",
    instagram: "https://www.instagram.com/buzzardd239/",
  },
  cvFile: "Oleksandr_Vahabov_CV.pdf",
  stack: ["TypeScript", "Python", "PostgreSQL", "Docker"],
};
