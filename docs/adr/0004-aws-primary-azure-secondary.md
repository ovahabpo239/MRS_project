# ADR-0004: AWS as the primary cloud, Azure kept as a second target

- **Status:** accepted
- **Date:** 2026-10-19

## Context

The project started on Azure (ADR-0002, ADR-0003), and the Azure Terraform works: a permanent
bootstrap layer and an ephemeral `dev` environment with AKS. AWS is now the main cloud: it is the
platform most of the target roles ask for, and an AWS account with Free Tier credit (about
USD 100) is available. Throwing the Azure work away would waste a working stack, and the spec
already lists "a second cloud deployment target to prove portability" as a stretch goal.

The two credits are very different in size. AWS also has no free managed Kubernetes control plane:
EKS bills USD 0.10 per hour for as long as a cluster exists, while the AKS free tier costs nothing.

## Decision

- **AWS is primary.** `docs/spec.md` describes the AWS design; `make cloud-*` targets AWS by default.
- **Azure stays as a second target.** Its design is kept in `docs/spec-azure.md`, and its code
  moved unchanged to `infra/terraform/azure/` and `infra/scripts/azure/`. `CLOUD=azure` selects it
  in every `make cloud-*` target, and it keeps its own CI workflow (`infra-azure.yml`).
- **Same shape on both clouds.** Each cloud has `bootstrap/` (permanent: state storage, GitHub
  OIDC identity for CI, budget), `envs/<env>/` (ephemeral) and `modules/`, plus `bootstrap.sh` and
  `nuke.sh`. ADR-0003 applies to both unchanged.

| Concern | AWS | Azure |
|---|---|---|
| State | S3 bucket with native lock files | Storage account with blob leases |
| CI identity | IAM role trusted through GitHub OIDC | User-assigned identity with federated credentials |
| CI guard rail | IAM limited to `resonance-*` roles that carry a PowerUser permissions boundary | RBAC Administrator limited to a fixed list of roles |
| Cluster | EKS, managed node groups, access entries, Pod Identity | AKS, node pools, Entra RBAC, workload identity |
| Secrets | KMS key + Secrets Manager prefix | Key Vault |
| Teardown safety net | Tag and name lookups per resource type | Delete tagged resource groups |

- **Cloud-neutral layers stay that way.** Images live in GHCR; Helm charts, Argo CD and
  observability run inside Kubernetes and do not know which cloud they are on.

## Alternatives considered

| Option | Why not (or when we would choose it instead) |
|---|---|
| Move fully to AWS and delete the Azure code | Loses a working, reviewed stack and the portability story. We would delete it if keeping both in sync started to slow down real feature work. |
| Stay on Azure as primary | Larger credit, free AKS control plane. We would go back if the AWS credit runs out before the project is done. |
| One set of cloud-agnostic Terraform modules with a cloud switch | The two providers share almost no resource shapes, so the abstraction would hide the differences this portfolio is meant to show. |
| k3s on a single EC2 instance instead of EKS | About a quarter of the cost, but not managed Kubernetes, and it would diverge from the spec. Still the fallback if the EKS fee becomes the limit. |
| NAT gateway and private node subnets in dev | The production-style layout, but a NAT gateway costs about USD 1 per day on top of the cluster. Dev uses public subnets with security groups; private subnets come with the hub network. |

## Consequences

- An AWS environment costs about USD 4 per day while it is up (control plane, one t3.medium node,
  public IPv4 addresses), so the credit covers roughly 25 working days. The ephemeral model and
  the nightly nuke matter even more than on Azure.
- Changes to the shared design (layers, naming, tags, CI flow) have to be made twice. Cloud-specific
  details only change where they live.
- Unlike AKS, an EKS managed node group does not autoscale by itself. Scaling the app group from
  zero needs Cluster Autoscaler or Karpenter, which is installed from `platform/`.
- Existing Azure checkouts only need `terraform init -reconfigure` after the move; state keys did
  not change.
