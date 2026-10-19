#!/usr/bin/env bash
# Safety net for when `terraform destroy` was skipped or failed: removes every ephemeral resource
# group of the project, purges soft-deleted Key Vaults so their names are free again, and deletes
# the ephemeral state files so the next apply starts clean.
#
# It only ever selects resource groups tagged project=<project> and lifecycle=ephemeral (plus
# their AKS node groups); the permanent rg-<project>-shared also carries a delete lock.
#
# Usage: nuke.sh [--yes] [--project NAME]
#   Without --yes it only prints what it would delete.
set -euo pipefail

project=resonance
apply=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) apply=true ;;
    --project) project="$2"; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

backend="$(cd "$(dirname "$0")/../../terraform/azure" && pwd)/backend.hcl"

run() {
  if $apply; then
    "$@"
  else
    echo "would run: $*"
  fi
}

delete_groups() {
  local groups="$1" failed=0 pids=()
  for group in $groups; do
    if $apply; then
      az group delete --name "$group" --yes &
      pids+=($!)
    else
      echo "would run: az group delete --name $group --yes"
    fi
  done
  for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
  return $failed
}

# Environment groups first: deleting a cluster also removes its node group. Node groups are then
# swept separately in case a cluster was lost without taking its group along.
groups=$(az group list \
  --query "[?tags.project=='$project' && tags.lifecycle=='ephemeral' && !ends_with(name, '-nodes')].name" -o tsv)
echo "Ephemeral resource groups: ${groups:-none}"
delete_groups "$groups"

node_groups=$(az group list \
  --query "[?starts_with(name, 'rg-$project-') && ends_with(name, '-nodes')].name" -o tsv)
[[ -z "$node_groups" ]] || echo "Leftover node groups: $node_groups"
delete_groups "$node_groups"

vaults=$(az keyvault list-deleted --resource-type vault --query "[?starts_with(name, 'kv-$project-')].name" -o tsv)
for vault in $vaults; do
  run az keyvault purge --name "$vault"
done

if [[ -f "$backend" ]]; then
  account=$(sed -n 's/^storage_account_name *= *"\(.*\)"/\1/p' "$backend")
  states=$(az storage blob list --auth-mode login --account-name "$account" --container-name tfstate \
    --query "[?name!='bootstrap.tfstate'].name" -o tsv)
  for state in $states; do
    # An interrupted apply leaves its state lock (a blob lease) behind; break it if present.
    if $apply; then
      az storage blob lease break --auth-mode login --account-name "$account" --container-name tfstate \
        --blob-name "$state" >/dev/null 2>&1 || true
    fi
    run az storage blob delete --auth-mode login --account-name "$account" --container-name tfstate --name "$state"
  done
fi

$apply || echo "Dry run. Re-run with --yes to delete."
