import { beforeAll, vi } from "vitest";

// `server-only` throws outside a React Server environment; neutralise it for tests.
vi.mock("server-only", () => ({}));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for integration tests (run `make web-test-int`).");
}
// These tests TRUNCATE tables. Refuse to run against anything that is not clearly a test database,
// so a wrong DATABASE_URL can never wipe development or production data.
const databaseName = new URL(process.env.DATABASE_URL).pathname.slice(1);
if (!databaseName.endsWith("_test")) {
  throw new Error(
    `Refusing to run integration tests against "${databaseName}": the database name must end in "_test" (run \`make web-test-int\`).`,
  );
}
process.env.SMTP_HOST ??= "localhost";
process.env.SITE_URL ??= "http://localhost:5003";

beforeAll(async () => {
  const { runMigrations } = await import("@/server/db/migrate");
  await runMigrations();
});
