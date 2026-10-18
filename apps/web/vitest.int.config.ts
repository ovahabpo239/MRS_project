import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests run against a real Postgres (DATABASE_URL), never a mock.
export default defineConfig({
  resolve: {
    alias: {
      "@tests": fileURLToPath(new URL("./tests", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // One database, so run test files one after another.
    fileParallelism: false,
    testTimeout: 20_000,
    setupFiles: ["./tests/support/setup-integration.ts"],
  },
});
