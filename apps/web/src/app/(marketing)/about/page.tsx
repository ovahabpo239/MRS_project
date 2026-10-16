import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import {
  AboutHeader,
  Background,
  ExperienceList,
  ProjectList,
  Skills,
  getCvDownloadHref,
} from "@/features/about";

export const metadata: Metadata = {
  title: "About",
  description: `${siteConfig.fullName}: AI / ML engineer. Experience, projects, skills and contact.`,
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-section-gap px-margin-mobile pb-section-gap pt-40 md:px-margin-desktop">
      <AboutHeader cvHref={getCvDownloadHref()} />
      <Skills />
      <ExperienceList />
      <ProjectList />
      <Background />
    </div>
  );
}
