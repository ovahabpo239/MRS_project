# Web app

Projects hub: a showcase of the projects in this repository and beyond, with accounts and email
notifications (accounts and notifications are delivered in later steps, see the roadmap below).

Next.js (App Router) + TypeScript (strict) + Tailwind CSS 3. The visual design is adapted from the
free "webdev-free" template by [TemplatesJungle](https://templatesjungle.com/); keep the footer
credit unless you have the no-attribution licence.

## Run it

```bash
# Local development (Node 22, see .nvmrc). Serves http://localhost:5003
cd apps/web && cp .env.example .env.local && npm ci && npm run dev

# Or in Docker, from the repository root
make web-up
```

| Command                              | What it does                         |
| ------------------------------------ | ------------------------------------ |
| `npm run lint` / `npm run typecheck` | ESLint (incl. layer rules) / `tsc`   |
| `npm run format:check`               | Prettier (`npm run format` to fix)   |
| `npm test`                           | Vitest unit tests                    |
| `npm run build`                      | Production build (standalone output) |

Environment variables are validated at startup in `src/lib/env.ts`; see `.env.example`.

## Architecture

```
src/
  app/                  Routing only: routes, layouts, metadata. No business logic.
  components/
    marketing/          Page sections. May compose features.
    layout/ ui/ effects Generic building blocks. Must not import features.
  features/<name>/      One folder per domain: components, schema, service, index.ts.
  server/               Server-only infrastructure (added with the database).
  lib/ config/          Pure helpers and site constants.
```

Rules, enforced by `eslint-plugin-boundaries` (`eslint.config.mjs`):

- `app` -> `components/marketing` -> `features` -> `components`, `server`, `lib`, `config`.
- Nothing imports from `app`. `lib` and `config` import nothing above them.
- Import a feature through its `index.ts`, not its internals.
- Server Components by default; client components are small islands (`"use client"`).
- Validate at boundaries with Zod; types are inferred from the schema.

## Add a project

Append an entry to `src/features/projects/catalog.ts`. It is validated at import time (and by
`catalog.test.ts`), so a malformed entry fails the build. Leave `tryUrl` out until the project is
available.

## Roadmap

1. Foundation (this step): site, catalog, tooling, Docker, CI.
2. Accounts: Auth.js + Postgres, register/login/verify/reset, `/account`.
3. Email notifications: preferences, admin announcements, unsubscribe, e2e tests, ADRs.
