import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cv } from "../cv";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">{title}</h2>
        <div className="h-1 w-16 bg-primary" />
      </div>
      {children}
    </section>
  );
}

function BulletList({ bullets }: { bullets: readonly string[] }) {
  return (
    <ul className="space-y-2 font-body-md text-body-md text-on-surface-variant">
      {bullets.map((bullet) => (
        <li key={bullet} className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary-fixed-dim"
          />
          <span>{bullet}</span>
        </li>
      ))}
    </ul>
  );
}

export function Skills() {
  return (
    <Section title="Skills">
      <dl className="grid gap-gutter md:grid-cols-3">
        {cv.skills.map((group) => (
          <div key={group.label} className="glass-card space-y-4 rounded-xl p-6">
            <dt className="font-label-caps text-label-caps text-secondary">{group.label}</dt>
            <dd className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <Badge key={item} className="normal-case">
                  {item}
                </Badge>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function ExperienceList() {
  return (
    <Section title="Experience">
      <ol className="space-y-gutter">
        {cv.experience.map((job) => (
          <li
            key={`${job.organization}-${job.period}`}
            className="glass-card space-y-6 rounded-xl p-6 md:p-8"
          >
            <div className="flex flex-col justify-between gap-1 md:flex-row md:items-baseline">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">{job.role}</h3>
                <p className="font-body-md text-body-md text-primary">
                  {job.organization}
                  {"location" in job && job.location ? ` · ${job.location}` : ""}
                </p>
              </div>
              <p className="font-code-sm text-code-sm text-on-surface-variant">{job.period}</p>
            </div>
            {job.groups.map((group) => (
              <div key={group.title ?? "main"} className="space-y-3">
                {group.title && (
                  <h4 className="font-label-caps text-label-caps text-secondary">{group.title}</h4>
                )}
                <BulletList bullets={group.bullets} />
              </div>
            ))}
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function ProjectList() {
  return (
    <Section title="Projects">
      <ul className="space-y-gutter">
        {cv.projects.map((project) => (
          <li key={project.title} className="glass-card space-y-4 rounded-xl p-6 md:p-8">
            <div className="flex flex-col justify-between gap-1 md:flex-row md:items-baseline">
              <h3 className="font-headline-md text-headline-md text-on-surface">{project.title}</h3>
              <p className="font-code-sm text-code-sm text-on-surface-variant">{project.tag}</p>
            </div>
            <BulletList bullets={project.bullets} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Background() {
  const { education } = cv;
  return (
    <div className="grid gap-section-gap md:grid-cols-2 md:gap-gutter">
      <Section title="Education">
        <div className="glass-card space-y-3 rounded-xl p-6">
          <p className="font-code-sm text-code-sm text-on-surface-variant">{education.period}</p>
          <h3 className="font-headline-md text-headline-md text-on-surface">{education.degree}</h3>
          <p className="text-on-surface-variant">{education.school}</p>
          <BulletList bullets={education.notes} />
        </div>
      </Section>
      <div className="space-y-section-gap">
        <Section title="Certifications">
          <ul className="space-y-3">
            {cv.certifications.map((item) => (
              <li key={item.name} className="glass-card flex flex-col gap-1 rounded-xl p-6">
                <span className="font-code-sm text-code-sm text-on-surface-variant">
                  {item.date}
                </span>
                <span className="font-body-md text-on-surface">{item.name}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Languages">
          <ul className="flex flex-wrap gap-2">
            {cv.languages.map((language) => (
              <li key={language.name}>
                <Badge className="normal-case">
                  {language.name} · {language.level}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
