import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client";

export type RateLimit = { limit: number; windowSeconds: number };

/**
 * Fixed-window counter in Postgres: atomic, shared across instances, no extra infrastructure.
 * Returns true if the request is within the limit. The attempt is counted either way.
 */
export async function consume(key: string, { limit, windowSeconds }: RateLimit): Promise<boolean> {
  const result = await getDb().execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, count, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
        THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE
        WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
        THEN now() ELSE rate_limits.window_start END
    RETURNING count
  `);
  const count = Number(result.rows[0]?.count ?? 1);
  return count <= limit;
}
