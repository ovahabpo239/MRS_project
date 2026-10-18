.PHONY: up down test lint fmt openapi logs web-dev web-deps web-up web-migrate web-lint web-test web-test-int web-build \
	cloud-bootstrap cloud-init cloud-plan cloud-up cloud-creds cloud-down cloud-nuke cloud-lint

COMPOSE ?= docker compose
TF_ROOT := infra/terraform
CLOUD_ENV ?= dev
TF_ENV = terraform -chdir=$(TF_ROOT)/envs/$(CLOUD_ENV)

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=100

test:
	uv run pytest

lint:
	uv run ruff check .
	uv run ruff format --check .
	uv run mypy apps

fmt:
	uv run ruff check --fix .
	uv run ruff format .

openapi:
	uv run python -m feed.export_openapi apps/feed/openapi.json

# Web app (apps/web). Requires Node 22 and `npm ci` in apps/web for the non-Docker targets.
web-dev: web-deps
	npm --prefix apps/web run dev

# Only the web app's dependencies (database + mail catcher), for `npm run dev` on the host.
web-deps:
	$(COMPOSE) --profile web up -d --wait web-db mailpit

web-up:
	$(COMPOSE) --profile web up -d --build web

web-migrate: web-deps
	npm --prefix apps/web run db:migrate

# Runs against a separate `web_test` database: the tests truncate tables, so never `web`.
web-test-int: web-deps
	$(COMPOSE) exec -T web-db sh -c 'psql -U web -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '"'"'web_test'"'"'" | grep -q 1 || psql -U web -d postgres -c "CREATE DATABASE web_test"'
	DATABASE_URL=postgres://web:web-local-only@localhost:5018/web_test npm --prefix apps/web run test:int

web-lint:
	npm --prefix apps/web run lint
	npm --prefix apps/web run typecheck
	npm --prefix apps/web run format:check

web-test:
	npm --prefix apps/web test

web-build:
	npm --prefix apps/web run build

# Azure (infra/terraform). Requires `az login`. See infra/README.md for the layers.
# Permanent layer: state account, CI identity, budget. Run once per subscription.
cloud-bootstrap:
	infra/scripts/bootstrap.sh

cloud-init:
	$(TF_ENV) init -input=false -reconfigure -backend-config=../../backend.hcl

cloud-plan: cloud-init
	$(TF_ENV) plan

cloud-up: cloud-init
	$(TF_ENV) apply

# Needs kubelogin for Entra-only clusters: `az aks install-cli`.
cloud-creds:
	az aks get-credentials -g rg-resonance-$(CLOUD_ENV) -n aks-resonance-$(CLOUD_ENV) --overwrite-existing
	kubelogin convert-kubeconfig -l azurecli

cloud-down: cloud-init
	$(TF_ENV) destroy

# Deletes every ephemeral resource group and its state, even if Terraform lost track of it.
cloud-nuke:
	infra/scripts/nuke.sh
	@printf "Delete all of the above? [y/N] "; read answer; \
	if [ "$$answer" = y ]; then infra/scripts/nuke.sh --yes; else echo "Nothing deleted."; fi

cloud-lint:
	terraform fmt -check -recursive $(TF_ROOT)
	cd $(TF_ROOT) && tflint --init && tflint --recursive --config "$$(pwd)/.tflint.hcl"
