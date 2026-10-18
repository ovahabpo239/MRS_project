export async function register() {
  // Only the Node.js server runtime talks to Postgres (not the edge runtime).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.RUN_MIGRATIONS !== "true") return;

  const { runMigrations } = await import("@/server/db/migrate");
  await runMigrations();
  console.log(JSON.stringify({ level: "info", msg: "database migrations applied" }));
}
