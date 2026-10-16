import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { ProjectStatus } from "../schema";

const labels: Record<ProjectStatus, string> = { live: "Live", beta: "Beta", soon: "Coming soon" };
const tones: Record<ProjectStatus, string> = {
  live: "bg-secondary/15 text-secondary",
  beta: "bg-primary-fixed-dim/15 text-primary-fixed-dim",
  soon: "bg-white/10 text-on-surface-variant",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge className={cn(tones[status])}>{labels[status]}</Badge>;
}
