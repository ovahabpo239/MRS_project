import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import { defineConfig, globalIgnores } from "eslint/config";

// Layering rules (see apps/web/README.md):
//   app (routing) -> sections (components/marketing) -> features -> components, server, lib, config
//   Nothing imports from app/. Inside a feature the order is actions -> service -> repository.
const allow = (...types) => ({ to: { element: { types: { anyOf: types } } } });

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "coverage/**", "playwright-report/**", "temp/**"]),
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "app", pattern: "src/app" },
        // Page sections compose features; listed before `components` so they match first.
        { type: "sections", pattern: "src/components/marketing" },
        { type: "components", pattern: "src/components" },
        { type: "feature", pattern: "src/features/*", capture: ["feature"] },
        { type: "server", pattern: "src/server" },
        { type: "lib", pattern: "src/lib" },
        { type: "config", pattern: "src/config" },
      ],
      "import/resolver": { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { type: "app" } },
              allow: allow("app", "sections", "feature", "components", "server", "lib", "config"),
            },
            {
              from: { element: { type: "sections" } },
              allow: allow("sections", "feature", "components", "lib", "config"),
            },
            {
              from: { element: { type: "feature" } },
              allow: allow("feature", "components", "server", "lib", "config"),
            },
            {
              from: { element: { type: "components" } },
              allow: allow("components", "lib", "config"),
            },
            { from: { element: { type: "server" } }, allow: allow("server", "lib", "config") },
            { from: { element: { type: "lib" } }, allow: allow("lib", "config") },
            { from: { element: { type: "config" } }, allow: allow("config") },
          ],
        },
      ],
    },
  },
]);
