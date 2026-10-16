import { z } from "zod";

export const projectStatusSchema = z.enum(["live", "beta", "soon"]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

const updateSchema = z.object({
  date: z.iso.date(),
  kind: z.enum(["NEW", "UPDATE", "RELEASE"]),
  text: z.string().min(1),
});

export const projectSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  title: z.string().min(1),
  /** One line, shown on cards. */
  summary: z.string().min(1).max(160),
  /** Paragraphs shown on the project page. */
  description: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string().min(1)).min(1),
  status: projectStatusSchema,
  /** Where "Try it" goes. Omit while the project is not available yet. */
  tryUrl: z.url().optional(),
  repoUrl: z.url().optional(),
  /** When true, "Try it" requires a signed-in user with a verified email. */
  requiresAccount: z.boolean(),
  updates: z.array(updateSchema),
});

export type Project = z.infer<typeof projectSchema>;
export type ProjectUpdate = z.infer<typeof updateSchema>;
