.PHONY: up down test lint fmt openapi logs web-dev web-deps web-up web-migrate web-lint web-test web-test-int web-build \
	cloud-bootstrap cloud-init cloud-plan cloud-up cloud-creds cloud-down cloud-nuke cloud-lint

COMPOSE ?= docker compose
CLOUD ?= aws
CLOUDS := aws azure
TF_ROOT = infra/terraform/$(CLOUD)
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

# Cloud (infra/terraform/$(CLOUD)). AWS by default and needs `aws configure`; CLOUD=azure needs
# `az login`. See infra/README.md (AWS) and infra/README-azure.md for the layers.
# Permanent layer: state storage, CI identity, budget. Run once per account or subscription.
cloud-bootstrap:
	infra/scripts/$(CLOUD)/bootstrap.sh

cloud-init:
	$(TF_ENV) init -input=false -reconfigure -backend-config=../../backend.hcl

cloud-plan: cloud-init
	$(TF_ENV) plan

cloud-up: cloud-init
	$(TF_ENV) apply

# Runs the environment's own get_credentials output. Azure also needs kubelogin: `az aks install-cli`.
cloud-creds: cloud-init
	eval "$$($(TF_ENV) output -raw get_credentials)"

cloud-down: cloud-init
	$(TF_ENV) destroy

# Deletes every ephemeral resource and its state, even if Terraform lost track of it.
cloud-nuke:
	infra/scripts/$(CLOUD)/nuke.sh
	@printf "Delete all of the above? [y/N] "; read answer; \
	if [ "$$answer" = y ]; then infra/scripts/$(CLOUD)/nuke.sh --yes; else echo "Nothing deleted."; fi

# Both clouds, whatever CLOUD is set to.
cloud-lint:
	terraform fmt -check -recursive infra/terraform
	for cloud in $(CLOUDS); do \
		(cd infra/terraform/$$cloud && tflint --init && tflint --recursive --config "$$(pwd)/.tflint.hcl") || exit 1; \
	done
