# infra

Terraform for Azure. The cloud is torn down after every working iteration, so the code is split by
lifetime ([ADR-0003](../docs/adr/0003-ephemeral-cloud-environments.md)):

| Layer | Path | Resource group | Lifetime | Holds |
|---|---|---|---|---|
| Permanent | `terraform/bootstrap` | `rg-resonance-shared` (delete-locked) | Applied once by hand | Terraform state account, GitHub Actions identity (OIDC), subscription budget |
| Ephemeral | `terraform/envs/dev` | `rg-resonance-dev` and `rg-resonance-dev-nodes` | Created and destroyed every iteration | VNet, AKS (free tier, 1 system node, app pool 0-2), Key Vault |

Shared modules live in `terraform/modules/`. `terraform/backend.hcl` is written by the first
bootstrap run and committed: it holds the state account name, which is not a secret.

**Cost while torn down:** only the state storage account, a few cents per month.
**Cost while `dev` is up:** about USD 2-3 per day with the defaults (B2s system node, standard
load balancer and public IP, small disks), plus app pool nodes while they are scaled up.

## Prerequisites

- Terraform 1.15+, Azure CLI logged in (`az login`) with Owner on the subscription
- `kubelogin` for cluster access: `az aks install-cli`
- Optional: `tflint` for `make cloud-lint`

## First time per subscription

```bash
cp infra/terraform/bootstrap/terraform.tfvars.example infra/terraform/bootstrap/terraform.tfvars
# set budget_contact_emails, then:
make cloud-bootstrap
```

The first run applies with local state, writes `infra/terraform/backend.hcl` and moves the state
into the new account (retrying while the storage role assignment takes effect). Commit
`backend.hcl` and the `.terraform.lock.hcl` files afterwards. Later runs of `make cloud-bootstrap`
are a plain apply against the remote state.

To let CI work, add the printed `github_variables` as **repository variables**, create a GitHub
environment named `azure` (required reviewer, deployment branch `main`), and optionally set:

| Variable | Purpose |
|---|---|
| `AZURE_ADMIN_OBJECT_IDS` | JSON list of Entra object IDs that keep cluster and vault admin on CI-built environments, e.g. `["<your id>"]` (`az ad signed-in-user show --query id -o tsv`) |
| `CLOUD_KEEP_ALIVE` | `true` skips the nightly nuke |
| `INFRACOST_API_KEY` (secret) | Adds a cost estimate to PR plans |

## Every iteration

```bash
make cloud-up       # terraform apply of envs/dev (~10 min)
make cloud-creds    # kubeconfig + kubelogin
kubectl get nodes
# ... work ...
make cloud-down     # terraform destroy
```

Use `CLOUD_ENV=<name>` to target another directory under `terraform/envs/` once one exists.

CI equivalent: **Actions > infra > Run workflow**, then choose `plan`, `apply`, `destroy` or `nuke`.
Pull requests that touch `infra/` get fmt, validate, tflint, shellcheck and a plan in the job
summary.

## When state and reality disagree

If a destroy was skipped, failed halfway or the state was lost, run:

```bash
make cloud-nuke     # dry run first, then asks before deleting
```

It deletes every resource group tagged `project=resonance` + `lifecycle=ephemeral` (and leftover
`*-nodes` groups), purges soft-deleted `kv-resonance-*` vaults, breaks stale state locks and
deletes all state blobs except `bootstrap.tfstate`. The next `make cloud-up` then starts clean.
CI runs the same script every night at 02:00 UTC.

## Things to know

- `NetworkWatcherRG` is created by Azure with the first VNet in a region. It is free, and nothing
  here manages or deletes it.
- The budget is subscription-wide, because the credit is. Other projects in the subscription count
  towards it.
- The permanent layer is hard to delete on purpose: removing it means deleting the management lock
  and the `prevent_destroy` lifecycle rules by hand.
- Clusters have local accounts disabled. Access is through Entra ID and the
  "Azure Kubernetes Service RBAC Cluster Admin" role, which Terraform grants to whoever applies and
  to `admin_object_ids`.
