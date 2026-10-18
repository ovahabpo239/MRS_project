import "server-only";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { getDb } from "./client";

/** Apply pending SQL migrations from `drizzle/`. Safe to call repeatedly. */
export async function runMigrations(): Promise<void> {
  await migrate(getDb(), { migrationsFolder: path.join(process.cwd(), "drizzle") });
}
