# infra

Terraform for two clouds. **AWS is the main one** and is described here. Azure is kept as a
second target with the same layout, see [README-azure.md](README-azure.md)
([ADR-0004](../docs/adr/0004-aws-primary-azure-secondary.md)). Every `make cloud-*` target uses
AWS unless you pass `CLOUD=azure`.

```
infra/
  scripts/{aws,azure}/        bootstrap.sh, nuke.sh
  terraform/aws/              bootstrap/, envs/dev/, modules/{network,eks,secrets}, backend.hcl
  terraform/azure/            bootstrap/, envs/dev/, modules/{network,aks,keyvault}, backend.hcl
```

The cloud is torn down after every working iteration, so the code is split by lifetime
([ADR-0003](../docs/adr/0003-ephemeral-cloud-environments.md)):

| Layer | Path | Lifetime | Holds |
|---|---|---|---|
| Permanent | `terraform/aws/bootstrap` | Applied once by hand | S3 state bucket `resonance-tfstate-<account id>`, GitHub Actions OIDC role `resonance-github`, monthly AWS budget |
| Ephemeral | `terraform/aws/envs/dev` | Created and destroyed every iteration | VPC (2 public subnets, no NAT), EKS `eks-resonance-dev` (system node group of 1, app group 1-2), KMS key and read policy for `resonance/dev/*` secrets |

Everything is tagged `project=resonance`; the bootstrap carries `lifecycle=permanent` and the
environment `lifecycle=ephemeral`. `terraform/aws/backend.hcl` is written by the first bootstrap
run and committed: it holds the bucket name, which is not a secret.

**Cost while torn down:** only the state bucket, a few cents per month.
**Cost while `dev` is up:** about USD 5 per day with the defaults (EKS control plane $0.10/h,
two t3.medium nodes at about $0.04/h each, public IPv4 addresses, small gp3 volumes). With about
USD 100 of credit that is roughly 20 full days, so tear down at the end of every session.
`app_min_count = 0` drops the app node (about $1 per day) when the GitOps stack is not needed.

## Prerequisites

- Terraform 1.15+
- AWS CLI v2 configured (`aws configure`) for an IAM user or role with administrator access;
  `aws sts get-caller-identity` must work
- `kubectl`, and `helm` for `make gitops-up`
- Optional: `tflint` for `make cloud-lint`

## First time per account

```bash
cp infra/terraform/aws/bootstrap/terraform.tfvars.example infra/terraform/aws/bootstrap/terraform.tfvars
# set budget_contact_emails, then:
make cloud-bootstrap
```

The first run applies with local state, writes `infra/terraform/aws/backend.hcl` and moves the
state into the new bucket. Commit `backend.hcl` and the `.terraform.lock.hcl` files afterwards.
Later runs of `make cloud-bootstrap` are a plain apply against the remote state. AWS sends a
confirmation email for each budget subscriber.

To let CI work, add the printed `github_variables` (`AWS_ROLE_ARN`, `AWS_REGION`) as
**repository variables**, create a GitHub environment named `aws` (required reviewer, deployment
branch `main`), and optionally set:

| Variable | Purpose |
|---|---|
| `AWS_ADMIN_PRINCIPAL_ARNS` | JSON list of IAM ARNs that keep cluster admin on CI-built environments, e.g. `["arn:aws:iam::<account>:user/<you>"]` (`aws sts get-caller-identity --query Arn --output text`) |
| `CLOUD_KEEP_ALIVE` | `true` skips the nightly nuke (both clouds) |
| `INFRACOST_API_KEY` (secret) | Adds a cost estimate to PR plans |

## Every iteration

```bash
make cloud-up       # terraform apply of envs/dev (~15 min, mostly the EKS control plane)
make cloud-creds    # aws eks update-kubeconfig, context eks-resonance-dev
kubectl get nodes
make gitops-up K8S_ENV=dev   # Argo CD + root app; feed and observability follow from Git
make k8s-ports K8S_ENV=dev   # Argo CD :5004, Grafana :5005, feed :5006
# ... work ...
make cloud-down     # terraform destroy
```

Use `CLOUD_ENV=<name>` to target another directory under `terraform/aws/envs/` once one exists.
The GitOps side is described in [platform/README.md](../platform/README.md).

The app node group starts at one node and does not grow on its own until Cluster Autoscaler or
Karpenter is installed from `platform/`. To add a node by hand:
`aws eks update-nodegroup-config --cluster-name eks-resonance-dev --nodegroup-name app --scaling-config desiredSize=2`.

CI equivalent: **Actions > infra-aws > Run workflow**, then choose `plan`, `apply`, `destroy` or
`nuke`. Pull requests that touch the AWS paths get fmt, validate, tflint, shellcheck and a plan in
the job summary.

## When state and reality disagree

If a destroy was skipped, failed halfway or the state was lost, run:

```bash
make cloud-nuke     # dry run first, then asks before deleting
```

AWS has no resource groups, so the script looks resources up by tag and name and deletes them in
dependency order: EKS node groups and clusters, load balancers that Kubernetes created, VPC
contents and VPCs, the environment's `resonance-*` IAM roles and policies, `resonance/*` secrets,
`alias/resonance-*` KMS aliases (keys are scheduled for deletion after 7 days, the minimum), and
every state object except `bootstrap.tfstate`. The next `make cloud-up` then starts clean. CI
runs the same script every night at 02:00 UTC.

## Things to know

- **CI cannot escalate.** The `resonance-github` role has PowerUserAccess plus IAM rights limited
  to `resonance-*` roles and policies, and only for roles that carry the PowerUserAccess
  permissions boundary. Every role in `envs/` sets that boundary; a role without it fails to
  create from CI.
- **Cluster access** is through EKS access entries (`authentication_mode = "API"`, no aws-auth
  ConfigMap). Terraform grants `AmazonEKSClusterAdminPolicy` to whoever applies and to
  `admin_principal_arns`.
- **Nodes sit in public subnets** with public IPs to avoid the NAT gateway fee. Only the cluster
  security group may reach them; private subnets come with the hub network.
- **The cluster stays on standard support.** Extended support costs six times as much per hour.
- The budget is account-wide and measured before credits, so its alerts show how fast the credit
  burns, not what you pay.
- The permanent layer is hard to delete on purpose: removing it means editing the
  `prevent_destroy` rule on the bucket by hand.
