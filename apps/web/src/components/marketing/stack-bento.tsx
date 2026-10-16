import { Blocks } from "lucide-react";
import { Reveal } from "./reveal";
import { siteConfig } from "@/config/site";
import { projectStats, recentUpdates } from "@/features/projects";

export function StackBento() {
  const stats = projectStats();
  const updates = recentUpdates();

  return (
    <Reveal
      id="stack"
      className="mx-auto max-w-container-max scroll-mt-24 px-margin-mobile py-section-gap md:px-margin-desktop"
    >
      <h2 className="mb-16 font-headline-lg text-headline-lg text-on-surface">Under_The_Hood</h2>
      <div className="grid grid-cols-1 gap-gutter md:grid-cols-4">
        <div className="glass-card glow-hover flex flex-col justify-between rounded-xl p-8 md:col-span-2">
          <Blocks className="mb-6 size-10 text-primary" aria-hidden="true" />
          <div>
            <h3 className="mb-2 font-headline-md text-headline-md text-on-surface">
              One account, every project
            </h3>
            <p className="text-on-surface-variant">
              Each project runs as its own service. Sign up once and use the same account to try
              them all, and choose which updates you want to hear about by email.
            </p>
          </div>
        </div>
        <div className="glass-card glow-hover flex flex-col items-center justify-center rounded-xl p-8 text-center">
          <span className="font-headline-xl text-headline-xl text-secondary">{stats.total}</span>
          <p className="font-label-caps text-label-caps">Projects</p>
        </div>
        <div className="glass-card glow-hover flex flex-col items-center justify-center rounded-xl p-8 text-center">
          <span className="font-headline-xl text-headline-xl text-primary">{stats.live}</span>
          <p className="font-label-caps text-label-caps">Live now</p>
        </div>
        <div className="glass-card glow-hover rounded-xl p-8 md:col-span-1">
          <h3 className="mb-4 font-label-caps text-label-caps text-secondary">Core Tech</h3>
          <ul className="space-y-2 font-code-sm text-code-sm">
            {siteConfig.stack.map((tech) => (
              <li key={tech} className="group flex cursor-default items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary transition-transform group-hover:scale-150" />
                <span className="transition-colors group-hover:text-primary">{tech}</span>
              </li>
            ))}
          </ul>
        </div>
        <div id="updates" className="glass-card scroll-mt-24 rounded-xl p-8 md:col-span-3">
          <h3 className="mb-6 font-headline-md text-headline-md text-on-surface">Recent_Updates</h3>
          <ul className="rounded border border-white/5 bg-surface-container-lowest p-4 font-code-sm text-code-sm">
            {updates.map((update) => (
              <li
                key={`${update.projectSlug}-${update.date}-${update.text}`}
                className="mb-2 flex flex-wrap gap-x-4 rounded p-1 transition-colors last:mb-0 hover:bg-white/5"
              >
                <time dateTime={update.date} className="text-outline">
                  {update.date}
                </time>
                <span className="text-primary">{update.kind}</span>
                <span className="text-on-surface">
                  {update.projectTitle}: {update.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Reveal>
  );
}
