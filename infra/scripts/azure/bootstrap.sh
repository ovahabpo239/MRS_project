#!/usr/bin/env bash
# Applies the Azure permanent layer (infra/terraform/azure/bootstrap).
#
# The state account is created by this very stack, so the first run cannot use it yet: it applies
# with a local backend, writes infra/terraform/azure/backend.hcl from the outputs and then migrates
# the state into the new account. Every later run (backend.hcl present, no local state) is a plain
# init + apply against the remote state.
set -euo pipefail

root="$(cd "$(dirname "$0")/../../terraform/azure" && pwd)"
stack="$root/bootstrap"
backend="$root/backend.hcl"
override="$stack/backend_override.tf"
local_state="$stack/terraform.tfstate"

tf() { terraform -chdir="$stack" "$@"; }

migrate() {
  # A new data-plane role assignment can take a few minutes before the account accepts it.
  for attempt in $(seq 1 10); do
    if tf init -input=false -migrate-state -force-copy -backend-config="$backend" && tf state list >/dev/null; then
      mv "$local_state" "$local_state.migrated"
      rm -f "$local_state.backup"
      echo
      echo "Bootstrap state now lives in Azure. Commit infra/terraform/azure/backend.hcl."
      echo "GitHub repository variables:"
      tf output github_variables
      return 0
    fi
    echo "Storage role assignment not active yet, retrying in 30 s ($attempt/10)..."
    sleep 30
  done
  echo "Migration failed. Local state is kept in $local_state; re-run this script." >&2
  return 1
}

# Resume a first run that applied but did not finish migrating.
if [[ -f "$local_state" && -f "$backend" ]]; then
  migrate
  exit
fi

if [[ -f "$backend" ]]; then
  tf init -input=false -reconfigure -backend-config="$backend"
  tf apply
  exit
fi

echo "First run: applying with local state, then moving it to Azure Storage."
trap 'rm -f "$override"' EXIT
printf 'terraform {\n  backend "local" {}\n}\n' >"$override"
tf init -input=false -reconfigure
tf apply
tf output -raw backend_hcl >"$backend"
rm -f "$override"
migrate
