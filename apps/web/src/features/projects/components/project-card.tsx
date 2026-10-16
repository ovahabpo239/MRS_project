import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Project } from "../schema";
import { StatusBadge } from "./status-badge";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="glass-card glow-hover group relative flex flex-col space-y-4 overflow-hidden rounded-xl p-8">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-fixed-dim via-secondary to-transparent opacity-70"
      />
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={project.status} />
        {project.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>
      <h3 className="font-headline-md text-headline-md text-on-surface transition-colors group-hover:text-primary">
        {project.title}
      </h3>
      <p className="flex-grow font-body-md text-body-md text-on-surface-variant">
        {project.summary}
      </p>
      <Link
        href={`/projects/${project.slug}`}
        className="mt-4 inline-flex items-center gap-2 font-label-caps text-label-caps text-primary transition-transform after:absolute after:inset-0 hover:translate-x-1"
      >
        Details <ArrowUpRight className="size-[18px]" aria-hidden="true" />
      </Link>
    </article>
  );
}
