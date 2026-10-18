import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/features/auth";
import { StatusBadge, getProject, listProjects } from "@/features/projects";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return listProjects().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const project = getProject((await params).slug);
  if (!project) return {};
  return { title: project.title, description: project.summary };
}

export default async function ProjectPage({ params }: { params: Promise<Params> }) {
  const project = getProject((await params).slug);
  if (!project) notFound();

  // Sign-in implies a confirmed email (login is refused until the address is verified).
  const signedIn = project.requiresAccount ? Boolean(await getCurrentUser()) : true;

  return (
    <article className="mx-auto max-w-3xl px-margin-mobile pb-section-gap pt-40">
      <Link
        href="/projects"
        className="mb-10 inline-flex items-center gap-2 font-label-caps text-label-caps text-on-surface-variant transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All projects
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={project.status} />
        {project.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>
      <h1 className="mb-8 font-headline-xl-mobile text-headline-xl-mobile text-on-surface md:font-headline-lg md:text-headline-lg">
        {project.title}
      </h1>
      <div className="space-y-4 font-body-lg text-body-lg text-on-surface-variant">
        {project.description.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <div className="mt-12 flex flex-wrap gap-4">
        {!project.tryUrl ? (
          <span className="rounded-lg border border-white/10 px-8 py-4 font-label-caps text-label-caps text-on-surface-variant">
            Not available yet
          </span>
        ) : signedIn ? (
          <ButtonLink href={project.tryUrl} variant="shimmer">
            Try it
          </ButtonLink>
        ) : (
          <ButtonLink
            href={`/login?next=${encodeURIComponent(`/projects/${project.slug}`)}`}
            variant="shimmer"
          >
            Sign in to try it
          </ButtonLink>
        )}
        {project.repoUrl && (
          <ButtonLink href={project.repoUrl} variant="outline">
            View source
          </ButtonLink>
        )}
      </div>
    </article>
  );
}
