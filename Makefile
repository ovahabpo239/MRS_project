.PHONY: up down test lint fmt openapi logs web-dev web-deps web-up web-migrate web-lint web-test web-test-int web-build \
	cloud-bootstrap cloud-init cloud-plan cloud-up cloud-creds cloud-down cloud-nuke cloud-lint \
	kind-up kind-down kind-load-feed gitops-up k8s-ports argocd-password platform-lint

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

# Kubernetes and GitOps (platform/). K8S_ENV=local is the kind cluster from `make kind-up`;
# K8S_ENV=dev is EKS from `make cloud-up cloud-creds`. See platform/README.md.
K8S_ENV ?= local
REVISION ?= main
ARGOCD_CHART_VERSION := 10.10.5
KIND_CLUSTER := resonance
FEED_IMAGE := ghcr.io/ovahabpo239/resonance-feed
KUBE_CONTEXT_local := kind-$(KIND_CLUSTER)
KUBE_CONTEXT_dev := eks-resonance-dev
KUBE_CONTEXT = $(KUBE_CONTEXT_$(K8S_ENV))
KUBECTL = kubectl --context $(KUBE_CONTEXT)
KUBECONFORM = kubeconform -strict -summary -schema-location default \
	-schema-location 'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json'

kind-up:
	kind create cluster --config platform/kind/cluster.yaml

kind-down:
	kind delete cluster --name $(KIND_CLUSTER)

# Builds the feed image locally and loads it into kind as :main, so the chart can be tried
# before CI has pushed an image (or from a branch with REVISION=<branch>).
kind-load-feed:
	docker build -f apps/feed/Dockerfile --build-arg GIT_SHA=$$(git rev-parse --short HEAD) -t $(FEED_IMAGE):main .
	kind load docker-image --name $(KIND_CLUSTER) $(FEED_IMAGE):main

# Installs Argo CD and the environment's root app; Git drives everything after that. The patch
# always runs so a later `REVISION=main` really resets a cluster that once followed a branch.
gitops-up:
	@test -n "$(KUBE_CONTEXT)" || { echo "Unknown K8S_ENV=$(K8S_ENV); use local or dev"; exit 1; }
	helm upgrade --install argocd oci://ghcr.io/argoproj/argo-helm/argo-cd --version $(ARGOCD_CHART_VERSION) \
		--kube-context $(KUBE_CONTEXT) --namespace argocd --create-namespace \
		-f platform/argocd/values.yaml --wait --timeout 10m
	$(KUBECTL) apply -f platform/envs/$(K8S_ENV)/root.yaml
	$(KUBECTL) -n argocd patch application root --type merge \
		-p '{"spec":{"source":{"targetRevision":"$(REVISION)","helm":{"parameters":[{"name":"targetRevision","value":"$(REVISION)"}]}}}}'

# Argo CD on :5004, Grafana on :5005, feed on :5006 until Ctrl-C. Same on kind and EKS.
k8s-ports:
	@echo "Argo CD http://localhost:5004 | Grafana http://localhost:5005 | feed http://localhost:5006/docs"
	$(KUBECTL) -n argocd port-forward svc/argocd-server 5004:80 & \
	$(KUBECTL) -n observability port-forward svc/grafana 5005:3000 & \
	$(KUBECTL) -n resonance port-forward svc/feed 5006:80 & \
	wait

# Password of the Argo CD `admin` user.
argocd-password:
	@$(KUBECTL) -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo

# What CI runs on platform/ changes. Needs helm and kubeconform.
platform-lint:
	helm lint --strict platform/charts/feed platform/argocd/apps --set env=local
	for env in local dev; do \
		helm template root platform/argocd/apps -f platform/envs/$$env/apps.yaml | $(KUBECONFORM) || exit 1; \
		helm template feed platform/charts/feed -f platform/envs/$$env/feed.yaml | $(KUBECONFORM) || exit 1; \
	done
	kubectl kustomize platform/observability | $(KUBECONFORM)
	for env in local dev; do $(KUBECONFORM) platform/envs/$$env/root.yaml || exit 1; done
