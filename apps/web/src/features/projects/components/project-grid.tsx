import { listProjects } from "../service";
import { ProjectCard } from "./project-card";

export function ProjectGrid() {
  const projects = listProjects();
  return (
    <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.slug} project={project} />
      ))}
      <div className="flex flex-col justify-center rounded-xl border border-dashed border-white/15 p-8 text-center">
        <p className="font-label-caps text-label-caps text-on-surface-variant">More on the way</p>
      </div>
    </div>
  );
}
