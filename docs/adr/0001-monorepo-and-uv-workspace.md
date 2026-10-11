# ADR-0001: Monorepo with a uv workspace

- **Status:** accepted
- **Date:** 2026-10-11

## Context

Resonance has web, services, ML, data, LLM, platform and infrastructure code that evolve together
(shared event schemas, shared Helm conventions, one CI). It is built by one person, so
cross-repo coordination cost would be pure overhead.

## Decision

One repository, laid out as in the spec (`apps/ ml/ data/ llm/ platform/ infra/ sim/ docs/`).
Python code is managed as a single [uv](https://docs.astral.sh/uv/) workspace: one root
`uv.lock`, one `pyproject.toml` per service under `apps/`, Python pinned to 3.12.
Docker builds use the repo root as context so images reuse the workspace lock.

## Alternatives considered

| Option | Why not (or when we would choose it instead) |
|---|---|
| Polyrepo per service | Worth it with multiple teams and independent release cadences; here it only adds coordination cost. |
| Poetry / pip-tools | uv is faster, has first-class workspace support and a single lockfile. |
| Bazel / Pants | Excellent at large scale, but heavy for a project this size. Revisit if build times hurt. |

## Consequences

- CI must be path-filtered so a change to `infra/` does not rebuild every image.
- A shared lockfile means a dependency bump can touch several services; Renovate PRs are tested per service.
