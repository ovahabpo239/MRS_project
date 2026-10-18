import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getServerEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { __pool?: Pool };

function pool(): Pool {
  globalForDb.__pool ??= new Pool({ connectionString: getServerEnv().DATABASE_URL, max: 10 });
  return globalForDb.__pool;
}

export function getDb(): Database {
  return drizzle(pool(), { schema });
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await pool().query("select 1");
    return true;
  } catch {
    return false;
  }
}
