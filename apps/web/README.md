# Web app

Projects hub: a showcase of the projects in this repository and beyond, with accounts (email
registration, confirmation and login). Email notifications for project updates are next, see the
roadmap below.

Next.js (App Router) + TypeScript (strict) + Tailwind CSS 3 + Postgres (Drizzle ORM). The visual
design is adapted from the free "webdev-free" template by
[TemplatesJungle](https://templatesjungle.com/); keep the footer credit unless you have the
no-attribution licence.

## Run it

```bash
# Everything in Docker (app + Postgres + Mailpit), from the repository root
make web-up            # http://localhost:5003, emails at http://localhost:5017

# Or develop on the host (Node 22, see .nvmrc); starts only Postgres and Mailpit in Docker
cd apps/web && cp .env.example .env.local && npm ci
make web-migrate       # apply SQL migrations (the Docker app does this itself on startup)
make web-dev           # http://localhost:5003 with hot reload
```

| Command                              | What it does                                                   |
| ------------------------------------ | -------------------------------------------------------------- |
| `npm run lint` / `npm run typecheck` | ESLint (incl. layer rules) / `tsc`                             |
| `npm run format:check`               | Prettier (`npm run format` to fix)                             |
| `npm test`                           | Unit tests (no database needed)                                |
| `make web-test-int`                  | Integration tests on the `web_test` Postgres DB                |
| `npm run db:generate`                | Create a SQL migration after editing `src/server/db/schema.ts` |
| `npm run build`                      | Production build (standalone output)                           |

Environment variables are validated in `src/lib/env.ts`; see `.env.example`. Database and SMTP
settings are only read at request time, so `npm run build` needs no secrets.

## Accounts

Sign-up, email confirmation and sign-in are implemented without an auth framework (ADR to follow):
a small, auditable layer in `src/features/auth` and `src/server/auth`.

1. **Register** (`/register`): stores the user with an Argon2id password hash and emails a
   confirmation link (valid 24 hours, single use).
2. **Confirm** (`/verify-email?token=...`): the page shows a button and the click confirms. It does
   not confirm on page load, because mail scanners prefetch links and would burn the token.
3. **Sign in** (`/login`): refused until the email is confirmed (with a "resend" option). Success
   starts a server-side session and redirects to `?next=` (same-site paths only) or the main page.
4. **Forgot password** (`/forgot-password` then `/reset-password?token=...`): emails a one-hour,
   single-use link (only the newest link works). The answer is identical for unknown addresses and
   the mail is sent in the background, so neither the page nor its timing reveals which accounts
   exist. Setting the new password signs the account out on every device, marks the address as
   confirmed (the user just proved they control it) and emails a notice. Like confirmation, the
   link only opens a form: the token is used on submit, so mail scanners cannot burn it.
5. **Profile** (`/account`): shows your email, confirmation status and member-since date.
6. **Sign out** revokes the session in the database and clears the cookie.

Security properties, each covered by a test in `tests/integration/features/auth/service.test.ts`
or the unit tests under `tests/unit/`:

- Passwords: Argon2id (OWASP minimum cost), 10 to 128 characters.
- Sessions: 256-bit random token in an `httpOnly`, `SameSite=Lax` cookie (`__Host-` prefixed and
  `Secure` when `SITE_URL` is https). Only a SHA-256 hash is stored, so a database leak cannot be
  replayed. Sessions are revocable and expire after 30 days.
- Email tokens: stored hashed, single use (atomic delete-and-return), expire after 24 hours; a new
  link invalidates the previous one.
- No account enumeration: registering an existing address, logging in with an unknown address and
  resending for an unknown address all look the same to the caller, and unknown-user logins cost
  the same time as wrong passwords. Owners of an existing address get an email instead.
- Rate limits in Postgres (`rate_limits`): per email and, when a client IP is known, per IP.
  Behind a proxy, make sure it overwrites `X-Forwarded-For`; without one only the per-email limits
  apply.
- CSRF: Server Actions check the request origin. Open redirects are blocked by `safeNextPath`.

Local mail is caught by Mailpit (<http://localhost:5017>). For production set `SMTP_*`,
`MAIL_FROM` and an https `SITE_URL`.

## Architecture

```
src/
  app/                  Routing only: routes, layouts, metadata. No business logic.
  components/
    marketing/          Page sections. May compose features (e.g. the session-aware header).
    layout/ ui/ effects Generic building blocks. Must not import features.
  features/<name>/      One folder per domain: components, schema, service, repository, index.ts.
  server/               Server-only infrastructure: db, auth primitives, mail, rate limiting.
  lib/ config/          Pure helpers and site constants.
drizzle/                Generated SQL migrations (commit them).
tests/
  unit/                 Fast tests, no database. Mirrors src/ (tests/unit/lib/urls.test.ts).
  integration/          Tests against a real Postgres. Mirrors src/.
  support/              Shared helpers and setup. Import with "@tests/support/...".
```

Rules, enforced by `eslint-plugin-boundaries` (`eslint.config.mjs`):

- `app` -> `components/marketing` -> `features` -> `components`, `server`, `lib`, `config`.
- Nothing imports from `app`. `lib` and `config` import nothing above them.
- Inside a feature: actions -> service -> repository. Only repositories and `server/` touch the DB.
- Import a feature through its `index.ts`, not its internals.
- Server Components by default; client components are small islands (`"use client"`).
- Validate at boundaries with Zod; types are inferred from the schema. Expected failures are
  `Result` values (`src/lib/result.ts`), not exceptions.

## Add a project

Append an entry to `src/features/projects/catalog.ts`. It is validated at import time (and by
`tests/unit/features/projects/catalog.test.ts`), so a malformed entry fails the build. Leave `tryUrl` out until the project is
available. With `requiresAccount: true` the "Try it" button asks visitors to sign in first.

## Roadmap

1. Foundation: site, catalog, tooling, Docker, CI. Done.
2. Accounts: register, confirm email, sign in/out, forgot/reset password, profile. Done.
3. Email notifications: preferences, admin announcements, unsubscribe, e2e and accessibility
   tests, ADRs.
