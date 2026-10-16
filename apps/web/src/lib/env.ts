import "server-only";
import { z } from "zod";

const schema = z.object({
  SITE_URL: z.url().default("http://localhost:5003"),
});

export type Env = z.infer<typeof schema>;

/** Parse and validate the process environment once; fails fast with a readable message. */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = z.prettifyError(result.error);
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv();
  return cached;
}
