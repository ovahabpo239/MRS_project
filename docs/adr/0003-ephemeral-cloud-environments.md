# ADR-0003: Ephemeral cloud environments on a small permanent core

- **Status:** accepted
- **Date:** 2026-10-18
- **Note:** [ADR-0004](0004-aws-primary-azure-secondary.md) makes AWS the primary cloud. The same
  layering applies to both clouds; the Azure paths below now live under `infra/terraform/azure/`
  and `infra/scripts/azure/`.

## Context

The Azure credit (about USD 900, ADR-0002) has to last through data processing, GPU work and
experiments. Most of the cost is compute that only needs to exist while someone is working: AKS
nodes, the load balancer and, later, Databricks and GPU pools. The cloud is therefore wiped after
every working iteration. That only works if a teardown is complete (nothing keeps billing), safe
(state and access survive) and repeatable (a rebuild right after a teardown succeeds).

## Decision

Split Terraform into root modules with separate state, by lifetime:

1. **Permanent: `infra/terraform/bootstrap` → `rg-resonance-shared`.** It holds the Terraform
   state account (Entra-only access, versioning, soft delete), the GitHub Actions identity
   (federated OIDC credentials, no secrets) and the subscription budget. It is applied by hand,
   and a `CanNotDelete` lock plus `prevent_destroy` protect it. It costs cents per month.
2. **Ephemeral: `infra/terraform/envs/<env>` → `rg-resonance-<env>`.** This layer holds
   everything that costs money. It is created and destroyed every iteration, and every resource
   is tagged `lifecycle=ephemeral`.

Supporting choices:

- **Stable names, purged on destroy,** instead of random suffixes. Key Vault has no purge
  protection, and the provider purges it on destroy, so names stay predictable for docs, DNS and
  kubeconfig while rebuilds don't collide with soft-deleted resources. Log Analytics is left out
  for the same reason. Observability runs in the cluster.
- **Images live in GHCR,** outside Azure, so no registry has to survive a teardown.
- **Two teardown paths.** `terraform destroy` is the normal path. `infra/scripts/nuke.sh` is the
  safety net: it selects by tag, deletes the resource groups, purges vaults and drops the
  ephemeral state. CI runs it nightly unless `CLOUD_KEEP_ALIVE=true`.
- **Least-privilege CI.** The identity gets Contributor plus Role Based Access Control
  Administrator, with a condition that limits it to the roles an environment needs (AKS RBAC,
  Key Vault, Network Contributor). It cannot grant itself Owner, and it cannot remove the lock.

## Alternatives considered

| Option | Why not (or when we would choose it instead) |
|---|---|
| One stack, one state | A destroy would take the state backend and CI identity with it. |
| Terraform workspaces per environment | They share one configuration and backend key prefix, and drift is easy to miss. Separate root modules make the lifetimes explicit. We would choose workspaces for many identical short-lived preview environments. |
| Random name suffix per iteration | It avoids soft-delete collisions without purging, but every rebuild changes names, so docs, scripts and kubeconfig contexts drift. |
| Leave the environment running and scale to zero | The control plane, load balancer, public IP and disks still bill. Scale-to-zero stays in use *inside* an environment (the app pool). |
| ACR in the permanent group | It costs about USD 5 per month for something GHCR does for free. We would revisit this for private images that need geo-replication or Defender scanning. |
| State backend created by an `az` script | It is common, but it leaves the most important resource outside Terraform. Here the bootstrap applies once with local state and then migrates into the account it created. |

## Consequences

- Each iteration starts with `make cloud-up` (about 10 minutes for AKS) and ends with
  `make cloud-down`. Anything that must persist between iterations (datasets, model artifacts)
  needs an explicit home, decided per case in Phase 1. It will probably be a storage account in
  the permanent layer.
- The budget is subscription-wide, because the credit is. It also counts other projects in the
  same subscription.
- Environments that CI creates have the CI identity as Terraform's "current" principal, so humans
  need to be listed in `admin_object_ids` (`AZURE_ADMIN_OBJECT_IDS` in CI) to keep cluster access.
- Changing the permanent layer is deliberate: it means editing the lock or `prevent_destroy` by
  hand.
