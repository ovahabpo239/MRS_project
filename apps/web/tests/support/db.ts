import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

/** Empty every table between tests so they cannot influence each other. */
export async function resetDatabase(): Promise<void> {
  await getDb().execute(
    sql`TRUNCATE users, sessions, email_verification_tokens, rate_limits RESTART IDENTITY CASCADE`,
  );
}
