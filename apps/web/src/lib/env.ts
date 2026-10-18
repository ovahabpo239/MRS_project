import "server-only";
import { z } from "zod";

type Source = Record<string, string | undefined>;

const boolean = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const siteSchema = z.object({
  SITE_URL: z.url().default("http://localhost:5003"),
});

const serverSchema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL"),
  /** Apply SQL migrations on startup (set in Docker; use `npm run db:migrate` locally). */
  RUN_MIGRATIONS: boolean,
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: boolean,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().min(3).default("Alex Projects <no-reply@localhost>"),
});

export type SiteEnv = z.infer<typeof siteSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function parse<T extends z.ZodType>(schema: T, source: Source): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Public site settings. Safe to read at build time. */
export function parseSiteEnv(source: Source = process.env): SiteEnv {
  return parse(siteSchema, source);
}

/** Database and SMTP settings. Only read at request time, so `next build` needs no secrets. */
export function parseServerEnv(source: Source = process.env): ServerEnv {
  return parse(serverSchema, source);
}

let site: SiteEnv | undefined;
let server: ServerEnv | undefined;

export function getEnv(): SiteEnv {
  site ??= parseSiteEnv();
  return site;
}

export function getServerEnv(): ServerEnv {
  server ??= parseServerEnv();
  return server;
}

/** Cookies are only marked Secure when the site is served over https. */
export function isSecureSite(): boolean {
  return getEnv().SITE_URL.startsWith("https://");
}
