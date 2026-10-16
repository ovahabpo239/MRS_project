import { projectSchema, type Project } from "./schema";

/**
 * The project catalog. Add a project by appending an entry; it is validated at import time,
 * so a typo fails the build and the unit tests instead of reaching production.
 */
const entries: unknown[] = [
  {
    slug: "resonance",
    title: "Resonance",
    summary:
      "Conversational, explainable music discovery: describe a vibe, get a playlist with reasons.",
    description: [
      "Resonance has two ways to find music: a personalized feed that learns from what you listen to, and a chat where you describe a vibe in plain language and get a playlist in which every track explains why it was picked.",
      "It is built as a deliberately complete system: data pipelines, a hybrid recommender, a fine-tuned small language model, a retrieval-augmented agent, and a Kubernetes platform with full observability.",
      "Status: early. The walking skeleton (feed service with health probes and a local observability stack) is in place; the user-facing app comes next.",
    ],
    tags: ["Python", "FastAPI", "Next.js", "ML"],
    status: "soon",
    repoUrl: "https://github.com/ovahabpo239/MRS_project",
    requiresAccount: true,
    updates: [
      {
        date: "2026-10-11",
        kind: "RELEASE",
        text: "Phase 0: feed service, health probes and local observability stack",
      },
      { date: "2026-10-10", kind: "NEW", text: "Project started" },
    ],
  },
];

export const projects: readonly Project[] = entries.map((entry) => projectSchema.parse(entry));
