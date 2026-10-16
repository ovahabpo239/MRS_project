import type { Metadata } from "next";
import { ProjectGrid } from "@/features/projects";

export const metadata: Metadata = {
  title: "Projects",
  description: "Everything I have built, what is live, and what is coming next.",
};

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-container-max px-margin-mobile pb-section-gap pt-40 md:px-margin-desktop">
      <div className="mb-16 space-y-4">
        <h1 className="font-headline-xl-mobile text-headline-xl-mobile text-on-surface md:font-headline-lg md:text-headline-lg">
          Projects
        </h1>
        <div className="h-1 w-24 bg-primary" />
      </div>
      <ProjectGrid />
    </div>
  );
}
