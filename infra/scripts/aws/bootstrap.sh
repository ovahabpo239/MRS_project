#!/usr/bin/env bash
# Applies the AWS permanent layer (infra/terraform/aws/bootstrap).
#
# The state bucket is created by this very stack, so the first run cannot use it yet: it applies
# with a local backend, writes infra/terraform/aws/backend.hcl from the outputs and then migrates
# the state into the new bucket. Every later run (backend.hcl present, no local state) is a plain
# init + apply against the remote state.
set -euo pipefail

root="$(cd "$(dirname "$0")/../../terraform/aws" && pwd)"
stack="$root/bootstrap"
backend="$root/backend.hcl"
override="$stack/backend_override.tf"
local_state="$stack/terraform.tfstate"

tf() { terraform -chdir="$stack" "$@"; }

# Unlike Azure there is no data-plane role to wait for: the bucket accepts the caller at once.
migrate() {
  tf init -input=false -migrate-state -force-copy -backend-config="$backend"
  tf state list >/dev/null
  mv "$local_state" "$local_state.migrated"
  rm -f "$local_state.backup"
  echo
  echo "Bootstrap state now lives in S3. Commit infra/terraform/aws/backend.hcl."
  echo "GitHub repository variables:"
  tf output github_variables
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

echo "First run: applying with local state, then moving it to S3."
trap 'rm -f "$override"' EXIT
printf 'terraform {\n  backend "local" {}\n}\n' >"$override"
tf init -input=false -reconfigure
tf apply
tf output -raw backend_hcl >"$backend"
rm -f "$override"
migrate
