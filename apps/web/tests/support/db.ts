import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

/** Empty every table between tests; CASCADE also empties every table that references users. */
export async function resetDatabase(): Promise<void> {
  await getDb().execute(sql`TRUNCATE users, rate_limits CASCADE`);
}
