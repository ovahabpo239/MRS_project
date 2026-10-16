import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CtaBanner } from "@/components/marketing/cta-banner";
import { Hero } from "@/components/marketing/hero";
import { Reveal } from "@/components/marketing/reveal";
import { StackBento } from "@/components/marketing/stack-bento";
import { ProjectGrid } from "@/features/projects";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Reveal className="mx-auto max-w-container-max px-margin-mobile py-section-gap md:px-margin-desktop">
        <div className="mb-16 flex flex-col items-end justify-between gap-6 md:flex-row">
          <div className="space-y-4">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Latest Projects</h2>
            <div className="h-1 w-24 bg-primary" />
          </div>
          <Link
            href="/projects"
            className="group flex items-center gap-2 font-label-caps text-label-caps text-primary transition-colors hover:text-secondary"
          >
            View All Projects
            <ArrowRight
              className="size-5 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        </div>
        <ProjectGrid />
      </Reveal>
      <StackBento />
      <CtaBanner />
    </>
  );
}
