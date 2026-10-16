import { Terminal } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { listProjects } from "@/features/projects";

export function Hero() {
  const projects = listProjects();

  return (
    <section className="mx-auto flex min-h-screen max-w-container-max items-center px-margin-mobile pt-20 md:px-margin-desktop">
      <div className="grid w-full grid-cols-1 items-center gap-gutter md:grid-cols-12">
        <div className="space-y-8 md:col-span-8">
          <div className="animate-hero delay-1 inline-block border-l-2 border-primary bg-surface-container-low px-4 py-2">
            <p className="flex items-center gap-2 font-code-sm text-code-sm text-primary">
              <Terminal className="size-3.5" aria-hidden="true" />
              system_status: online
            </p>
          </div>
          <h1 className="animate-hero delay-2 font-headline-xl-mobile text-headline-xl-mobile text-on-surface md:font-headline-xl md:text-headline-xl">
            <span className="block">Hello World,</span>
            <span className="block text-primary">I am {siteConfig.author}.</span>
            <span className="block">I build software.</span>
          </h1>
          <p className="animate-hero delay-3 max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
            {siteConfig.description}
          </p>
          <div className="animate-hero delay-3 flex flex-wrap gap-4 pt-4">
            <ButtonLink href="/projects" variant="solid">
              Browse projects
            </ButtonLink>
            <ButtonLink href={siteConfig.links.github} variant="outline">
              View GitHub
            </ButtonLink>
          </div>
        </div>
        <div className="animate-hero delay-3 hidden md:col-span-4 md:block">
          <div className="glass-card group relative overflow-hidden rounded-xl border-primary/20 p-6">
            <div className="absolute inset-0 bg-primary/5 transition-colors group-hover:bg-primary/10" />
            <pre
              aria-label="Current project statuses"
              className="relative z-10 space-y-2 font-code-sm text-code-sm text-on-surface-variant"
            >
              <span className="block text-secondary">const projects = {"{"}</span>
              {projects.map((project) => (
                <span key={project.slug} className="block pl-4">
                  {project.slug}: <span className="text-primary">&quot;{project.status}&quot;</span>
                  {","}
                </span>
              ))}
              <span className="block text-secondary">{"}"};</span>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
