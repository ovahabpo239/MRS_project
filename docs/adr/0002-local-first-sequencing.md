# ADR-0002: Prove the delivery loop locally before spending cloud credits

- **Status:** accepted
- **Date:** 2026-10-11
- **Note:** [ADR-0004](0004-aws-primary-azure-secondary.md) makes AWS the primary cloud. This
  decision applies to both clouds.

## Context

The spec's Phase 0 is cloud-first (Terraform, AKS, Argo CD). The project has roughly USD 900 of
Azure credits, which must also cover data processing, GPU nodes and experiments in later phases.

## Decision

Build the walking skeleton in two passes:

1. **Local:** docker compose for the observability stack and a kind cluster running Argo CD
   against the same Helm chart and GitOps layout that production will use.
2. **Azure:** lift the proven chart and app-of-apps onto AKS with Terraform.

Phase 0 only ends when both passes work (commit to dashboard on AKS).

## Alternatives considered

| Option | Why not (or when we would choose it instead) |
|---|---|
| Cloud-first (spec as written) | Every iteration on pipelines and charts burns credits and is slower. Would choose it if credits were unlimited or the cloud-specific parts were the risky ones. |
| Local only | Does not demonstrate the Cloud Architect and cost-control goals. |

## Consequences

- Local and cloud must stay structurally identical (same chart, overlays differ only by values).
- Some cloud-only concerns (workload identity, Key Vault, private endpoints) are only proven in the second pass.
