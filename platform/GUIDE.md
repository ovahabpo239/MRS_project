# The `platform/` folder, explained in detail

This is a file-by-file and concept-by-concept guide to everything under [platform/](.). It complements the shorter [README.md](README.md) (the quick-start) and [ADR-0005](../docs/adr/0005-gitops-delivery.md) (the decision record). Where this guide and those disagree, the files themselves are the source of truth.

Contents

1. [The one-paragraph summary](#1-the-one-paragraph-summary)
2. [Vocabulary](#2-vocabulary)
3. [Directory map](#3-directory-map)
4. [The big picture: three loops](#4-the-big-picture-three-loops)
5. [`kind/`: the local cluster](#5-kind-the-local-cluster)
6. [`argocd/values.yaml`: installing Argo CD](#6-argocdvaluesyaml-installing-argo-cd)
7. [`envs/`: one directory per environment](#7-envs-one-directory-per-environment)
8. [`argocd/apps/`: the app-of-apps chart](#8-argocdapps-the-app-of-apps-chart)
9. [`charts/feed/`: the feed service's Helm chart](#9-chartsfeed-the-feed-services-helm-chart)
10. [`observability/`: metrics, logs, traces and dashboards](#10-observability-metrics-logs-traces-and-dashboards)
11. [How the Makefile drives all of this](#11-how-the-makefile-drives-all-of-this)
12. [CI: the two workflows that touch `platform/`](#12-ci-the-two-workflows-that-touch-platform)
13. [End-to-end walkthroughs](#13-end-to-end-walkthroughs)
14. [Cross-file couplings (things that must change together)](#14-cross-file-couplings-things-that-must-change-together)
15. [Gotchas and things worth knowing](#15-gotchas-and-things-worth-knowing)
16. [What is deliberately not here yet](#16-what-is-deliberately-not-here-yet)
17. [Recipes: how to change things](#17-recipes-how-to-change-things)

---

## 1. The one-paragraph summary

`platform/` holds everything that runs **inside Kubernetes**. It is delivered by **Argo CD**, which watches this Git repository and makes the cluster match it (GitOps, pull-based). There is a **Helm chart for the `feed` service**, a **Kustomize bundle for the observability stack** (OpenTelemetry Collector, Prometheus, Loki, Tempo, Grafana), an **"app of apps" Helm chart** that tells Argo CD which of those two things to deploy, and a small **per-environment directory** (`local` for a kind cluster on your laptop, `dev` for EKS on AWS) holding only the values that differ. The observability config files are **shared with `docker-compose.yml`**, so the same files drive the laptop stack and the cluster.

## 2. Vocabulary

| Term | Meaning here |
|---|---|
| **GitOps** | The cluster's desired state lives in Git. Nobody runs `kubectl apply` or `helm upgrade` for day-to-day changes; a controller in the cluster pulls from Git and reconciles. |
| **Argo CD** | The controller that does the pulling. Its unit of work is an **Application**: "take *this path* of *this repo* at *this revision* and make *this namespace* in *this cluster* look like it". |
| **Application** | A custom resource (`argoproj.io/v1alpha1`, `kind: Application`). Lives in the `argocd` namespace. |
| **Root application** | The single Application you apply by hand once per cluster ([envs/*/root.yaml](envs/)). Everything else is created by it. |
| **App of apps** | A pattern where one Application's source renders *more Applications*. Here the source is the Helm chart in [argocd/apps/](argocd/apps/). |
| **Sync / prune / selfHeal** | *Sync* applies Git to the cluster. *Prune* deletes cluster objects that Git no longer has. *selfHeal* reverts manual changes made in the cluster. All three are on automatically. |
| **Helm chart** | A templated bundle of Kubernetes manifests plus a `values.yaml`. Two charts here: `feed` and `apps`. |
| **Kustomize** | A template-free way to assemble and patch plain manifests. Used for `observability/`. |
| **kind** | "Kubernetes in Docker": a throwaway local cluster. |
| **EKS** | AWS's managed Kubernetes. The `dev` environment. Created by Terraform in [infra/terraform/aws](../infra/terraform/aws). |
| **OTLP** | OpenTelemetry's wire protocol. The feed service speaks it to the collector (gRPC on 4317, HTTP on 4318). |
| **RED** | Rate, Errors, Duration: the three golden signals the Grafana dashboard shows. |

## 3. Directory map

```
platform/
├── README.md                         quick-start (shorter than this file)
├── GUIDE.md                          this file
│
├── kind/
│   └── cluster.yaml                  the local one-node cluster definition
│
├── argocd/
│   ├── values.yaml                   values for the upstream argo-cd chart (the install)
│   └── apps/                         the app-of-apps Helm chart
│       ├── Chart.yaml
│       ├── values.yaml               defaults: env, repoURL, targetRevision
│       └── templates/
│           ├── _helpers.tpl          env lookup + shared sync policy
│           ├── feed.yaml             Application -> platform/charts/feed
│           └── observability.yaml    Application -> platform/observability
│
├── envs/
│   ├── local/                        kind cluster
│   │   ├── root.yaml                 the root Application (applied by hand once)
│   │   ├── apps.yaml                 values for argocd/apps          (env: local)
│   │   └── feed.yaml                 values for charts/feed          (image tag etc.)
│   └── dev/                          EKS cluster
│       ├── root.yaml
│       ├── apps.yaml                 (env: dev)
│       └── feed.yaml                 (adds nodeSelector pool: app)
│
├── charts/
│   └── feed/                         Helm chart of the feed service
│       ├── Chart.yaml
│       ├── values.yaml               defaults for every environment
│       └── templates/
│           ├── _helpers.tpl          labels
│           ├── deployment.yaml
│           ├── service.yaml
│           └── serviceaccount.yaml
│
└── observability/
    ├── kustomization.yaml            entry point for the cluster (Argo CD reads this)
    ├── otel-collector.yaml  ┐
    ├── prometheus.yml       │ the real service configs,
    ├── loki.yaml            │ SHARED with docker-compose.yml
    ├── tempo.yaml           │
    ├── grafana/             ┘ provisioning/ (datasources, dashboard provider) + dashboards/feed-red.json
    └── k8s/                          Kubernetes wrappers around those configs
        ├── namespace.yaml
        ├── otel-collector.yaml       Deployment + Service
        ├── prometheus.yaml           Deployment + Service
        ├── loki.yaml                 Deployment + Service
        ├── tempo.yaml                Deployment + Service
        └── grafana.yaml              Deployment + Service
```

A useful way to read the tree: **`kind/` creates a cluster, `argocd/values.yaml` installs the controller, `envs/*/root.yaml` points the controller at this repo, `argocd/apps/` fans out into components, and `charts/` + `observability/` are the components.**

## 4. The big picture: three loops

There are three separate flows. Keeping them apart makes the whole thing much easier to reason about.

### Loop A: bootstrap (human, once per cluster)

```
make kind-up            (or: make cloud-up cloud-creds  for EKS)
make gitops-up          helm install argo-cd  ->  kubectl apply envs/<env>/root.yaml
```

After this, you never touch the cluster directly again. The only imperative step in the whole system is "install Argo CD and give it the root Application".

### Loop B: reconcile (Argo CD, every ~60 seconds, forever)

```
root Application ──renders──> platform/argocd/apps  (Helm, with envs/<env>/apps.yaml)
                                   │
                  ┌────────────────┴─────────────────┐
                  ▼                                  ▼
     Application "feed"                   Application "observability"
     path: platform/charts/feed           path: platform/observability
     values: envs/<env>/feed.yaml         (Kustomize)
     -> namespace "resonance"             -> namespace "observability"
```

Argo CD polls the Git repo (every 60 s, see [argocd/values.yaml](argocd/values.yaml)), re-renders, diffs against the live cluster, and applies/prunes/heals.

### Loop C: ship a code change (CI writes to Git, Loop B does the rest)

```
merge to main touching apps/feed
  └─> .github/workflows/feed.yml: test, build image, scan, push :sha-abc1234, sign
        └─> same workflow commits  image.tag: sha-abc1234  into  platform/envs/*/feed.yaml
              └─> Argo CD sees the new commit (<= ~1 min) and rolls the Deployment
                    └─> new pods emit telemetry carrying their git revision
                          └─> Grafana "Running version" panel shows the new revision
```

CI never talks to the cluster. It only writes a file in Git. That commit **is** the deploy record; reverting it **is** the rollback.

## 5. `kind/`: the local cluster

File: [kind/cluster.yaml](kind/cluster.yaml)

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: resonance
nodes:
  - role: control-plane
    image: kindest/node:v1.37.0@sha256:a1ed56...
```

- **`name: resonance`** gives the cluster the name `resonance`, so `kubectl` gets a context called **`kind-resonance`**. The Makefile hardcodes this: `KIND_CLUSTER := resonance` and `KUBE_CONTEXT_local := kind-$(KIND_CLUSTER)`.
- **One node, control-plane only.** kind lets workloads run on a lone control-plane node, so a single node is the whole cluster. Enough for a demo and light on RAM.
- **Image pinned by tag *and* digest** (`v1.37.0@sha256:...`). The tag is human-readable; the digest guarantees the exact bytes. The comment says this is kind v0.33.0's default node image, pinned as the kind release notes recommend.
- **No `extraPortMappings`, no ingress.** Nothing is exposed on the host. You reach services through `kubectl port-forward` (see [`make k8s-ports`](#k8s-ports)). That is intentional, and it makes kind behave exactly like EKS.
- The comment references **ADR-0002** (local-first sequencing): prove the GitOps flow on kind before paying for EKS.

Used by: `make kind-up` (`kind create cluster --config platform/kind/cluster.yaml`) and `make kind-down`.

## 6. `argocd/values.yaml`: installing Argo CD

File: [argocd/values.yaml](argocd/values.yaml)

This is **not** a manifest for this repo's own components. It is the *values file for the upstream `argo-cd` Helm chart* (chart version pinned in the Makefile as `ARGOCD_CHART_VERSION := 10.10.5`). `make gitops-up` runs:

```
helm upgrade --install argocd oci://ghcr.io/argoproj/argo-helm/argo-cd --version 10.10.5 \
  --kube-context <ctx> --namespace argocd --create-namespace \
  -f platform/argocd/values.yaml --wait --timeout 10m
```

Argo CD is the one thing that cannot manage itself on first boot (chicken and egg), which is why it's installed with Helm directly rather than via a child Application.

Key by key:

| Setting | Why |
|---|---|
| `global.domain: localhost:5004` | Argo CD builds links and callback URLs from this. 5004 is the port `make k8s-ports` forwards the UI to. |
| `configs.params.server.insecure: true` | Serve plain HTTP. TLS would normally end at an ingress/load balancer; there is none, only a `kubectl port-forward` on your laptop. |
| `configs.cm.timeout.reconciliation: 60s` (+ `jitter: 10s`) | How often Argo CD re-checks Git. The default is 120 s + jitter; 60 s makes commit-to-cluster visible faster in a demo. This is where the "about a minute" figure in the README comes from. |
| `configs.cm.exec.enabled: false` | Disables the web terminal into pods. Less attack surface. |
| `configs.cm.statusbadge.enabled: false` | Disables public status-badge endpoints. |
| `dex.enabled: false` | No SSO server; you log in as `admin`. |
| `notifications.enabled: false` | No notifications controller. |
| `applicationSet.replicas: 0` | No ApplicationSet controller (the app-of-apps chart replaces it; see ADR-0005's alternatives table). |
| `controller` / `repoServer` / `server` / `redis` `resources` | Small requests and memory limits (controller 256Mi→768Mi, repo-server 128Mi→512Mi, server 64Mi→256Mi, redis 32Mi→128Mi). Dev nodes are `t3.medium`, so Argo CD has to be slim. |

The header comment sums it up: *"only the four core components run"*: application-controller, repo-server, server, and redis.

**Credentials.** The chart generates a random `admin` password in a Secret. Retrieve it with `make argocd-password` (reads `argocd-initial-admin-secret`).

## 7. `envs/`: one directory per environment

An *environment* is a directory under `envs/`. Each holds exactly three files. This is the entire mechanism by which local and dev "differ only by values", which is what ADR-0002 requires.

### 7.1 `root.yaml`: the root Application

Files: [envs/local/root.yaml](envs/local/root.yaml), [envs/dev/root.yaml](envs/dev/root.yaml)

The two files are identical apart from the values file they reference (`local` vs `dev`) and the header comment.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/ovahabpo239/MRS_project.git
    targetRevision: main
    path: platform/argocd/apps
    helm:
      valueFiles:
        - ../../envs/local/apps.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

Line by line:

- **`namespace: argocd`**: Application objects must live in Argo CD's own namespace.
- **`finalizers: resources-finalizer.argocd.argoproj.io`**: makes deleting this Application a *cascading* delete: Argo CD first deletes everything the Application manages, then the Application. Because root manages the child Applications, deleting root tears down feed and observability too.
- **`project: default`**: Argo CD's built-in permissive project. No custom `AppProject` restricts repos/namespaces yet.
- **`source`**: *where the desired state comes from.*
  - `repoURL` + `targetRevision` + `path` pick a folder at a branch/tag/commit. Here, the app-of-apps chart at `platform/argocd/apps`, on `main`.
  - `helm.valueFiles` feeds `envs/<env>/apps.yaml` into that chart. The path is **relative to the chart path**: `platform/argocd/apps/../../envs/local/apps.yaml` is `platform/envs/local/apps.yaml`.
- **`destination`**: `https://kubernetes.default.svc` is Argo CD's name for "the cluster I'm running in". Namespace `argocd` is where the *rendered* children (which are Applications) go.
- **`syncPolicy.automated`**: `prune` deletes what's no longer in Git; `selfHeal` reverts manual drift. Note root does **not** set `CreateNamespace=true` (the `argocd` namespace already exists), unlike the children.

> **Branch testing.** `make gitops-up REVISION=<branch>` patches the live root Application so that *both* its own `targetRevision` *and* a Helm parameter `targetRevision` point at the branch (see [section 11](#gitops-up)). The parameter is what makes the children follow the branch too.

### 7.2 `apps.yaml`: values for the app-of-apps chart

Files: [envs/local/apps.yaml](envs/local/apps.yaml), [envs/dev/apps.yaml](envs/dev/apps.yaml)

One line each: `env: local` / `env: dev`. That is the whole file. Its only job is to tell the app-of-apps chart which `envs/<env>/` directory the children should read their values from.

### 7.3 `feed.yaml`: values for the feed chart

Files: [envs/local/feed.yaml](envs/local/feed.yaml), [envs/dev/feed.yaml](envs/dev/feed.yaml)

| Key | local | dev | Notes |
|---|---|---|---|
| `environment` | `local` | `dev` | Becomes the `deployment.environment.name` telemetry attribute. |
| `image.tag` | `main` | `main` → later `sha-xxxxxxx` | **Rewritten by CI** (`yq -i '.image.tag = ...'`) on every merge to main. Starts as the moving `main` tag until CI first runs. |
| `nodeSelector` | none | `pool: app` | On EKS, schedule feed onto the `app` node group (label `pool=app`, defined in [infra/terraform/aws/modules/eks/main.tf](../infra/terraform/aws/modules/eks/main.tf)). Argo CD and observability have no selector and "fill whatever room is left". |

Human-edited keys and the CI-edited key share a file. That's fine because CI only touches `.image.tag`.

### How values are layered

For the feed Application, Helm merges (later wins):

```
charts/feed/values.yaml          defaults for everyone
   <  envs/<env>/feed.yaml       per-environment overrides (and the CI-written image tag)
```

For the app-of-apps chart:

```
argocd/apps/values.yaml          env: "", repoURL, targetRevision: main
   <  envs/<env>/apps.yaml       env: local|dev
   <  root Application helm.parameters   (only when REVISION is patched in)
```

## 8. `argocd/apps/`: the app-of-apps chart

This is a Helm chart whose "manifests" are not Deployments but **Argo CD Applications**.

### 8.1 [Chart.yaml](argocd/apps/Chart.yaml) and [values.yaml](argocd/apps/values.yaml)

```yaml
# values.yaml
env: ""
repoURL: https://github.com/ovahabpo239/MRS_project.git
targetRevision: main
```

- `env: ""` is intentionally empty so that forgetting it fails loudly (see `required` below).
- `repoURL` is stamped into every child Application.
- `targetRevision` is the Git ref every child follows. The comment explains the branch-testing trick.

### 8.2 [templates/_helpers.tpl](argocd/apps/templates/_helpers.tpl)

Two named templates, reused by every child:

```gotemplate
{{- define "apps.env" -}}
{{- required "env is required (local, dev, ...)" .Values.env -}}
{{- end }}
```
`required` aborts rendering with that message if `env` is empty. This is why [`make platform-lint`](#platform-lint) passes `--set env=local` to `helm lint`.

```gotemplate
{{- define "apps.syncPolicy" -}}
syncPolicy:
  automated:
    prune: true
    selfHeal: true
  syncOptions:
  - CreateNamespace=true
{{- end }}
```
One place to define "how every child syncs": automatically, pruning, self-healing, and creating its target namespace if missing. Children include it with `{{- include "apps.syncPolicy" . | nindent 2 }}`.

### 8.3 [templates/feed.yaml](argocd/apps/templates/feed.yaml): child Application `feed`

| Field | Value | Meaning |
|---|---|---|
| `metadata.name` | `feed` | The Application's name in Argo CD. |
| `source.path` | `platform/charts/feed` | A Helm chart: Argo CD detects `Chart.yaml` and runs `helm template`. |
| `source.helm.releaseName` | `feed` | Fixes `.Release.Name` (used in labels) so it doesn't depend on the Application's name. |
| `source.helm.valueFiles` | `../../envs/<env>/feed.yaml` | Relative to `platform/charts/feed`, so it resolves to `platform/envs/<env>/feed.yaml`. The `<env>` is filled by `include "apps.env"`. |
| `destination.namespace` | `resonance` | Where feed runs. Created automatically (`CreateNamespace=true`). |

### 8.4 [templates/observability.yaml](argocd/apps/templates/observability.yaml): child Application `observability`

Same shape, but `path: platform/observability` and `destination.namespace: observability`. No Helm block: Argo CD sees a `kustomization.yaml` in that folder and runs Kustomize instead. It takes no per-environment values, so **observability is identical in local and dev**.

### 8.5 Why a Helm chart and not an ApplicationSet

From ADR-0005: ApplicationSets shine for many clusters or generated environments. With two hand-written environments, a 30-line chart is easier to read, and the `applicationSet` controller can stay at `replicas: 0`, saving memory on small nodes.

### 8.6 Adding a third component

1. Add `templates/<name>.yaml` to this chart (copy `feed.yaml`, change name/path/namespace; add a `valueFiles` entry only if it's a Helm chart that needs per-env values).
2. Add the chart or kustomization under `platform/`.
3. If it needs per-env values, add `envs/<env>/<name>.yaml` for each env.
4. Merge. The root Application creates the new child automatically.

## 9. `charts/feed/`: the feed service's Helm chart

The `feed` service is the FastAPI app in [apps/feed](../apps/feed). The chart deploys it as a single `Deployment`, a `Service` and a `ServiceAccount`. There is no Ingress, HPA, PDB or NetworkPolicy yet (see [section 16](#16-what-is-deliberately-not-here-yet)).

### 9.1 [values.yaml](charts/feed/values.yaml): the knobs

```yaml
environment: local          # -> telemetry attribute deployment.environment.name
replicaCount: 1
image:
  repository: ghcr.io/ovahabpo239/resonance-feed
  tag: main                 # overridden per env; CI rewrites it to sha-<7>
  pullPolicy: IfNotPresent
service:
  port: 80
logLevel: INFO
otel:
  endpoint: http://otel-collector.observability:4318   # "" turns telemetry off
  metricExportIntervalMs: 10000
resources:
  requests: { cpu: 50m, memory: 128Mi }
  limits:   { memory: 256Mi }          # no CPU limit on purpose
nodeSelector: {}
tolerations: []
serviceAccount:
  annotations: {}           # Pod Identity (EKS) / workload identity (AKS) bind here later
```

Notes:

- **`otel.endpoint`** uses the cross-namespace DNS form `service.namespace`: `otel-collector.observability`. That's how feed (namespace `resonance`) reaches the collector (namespace `observability`). Setting it to an empty string removes all the OTEL env vars from the pod, so the app runs with telemetry disabled.
- **Memory limit but no CPU limit** is a common practice: CPU limits cause throttling even when the node has spare CPU, while exceeding a memory limit is a hard error so it deserves a ceiling. Requests (50m CPU / 128Mi) are what the scheduler uses to place the pod.
- **`image.tag: main`** is a moving tag. With `pullPolicy: IfNotPresent` that's exactly what lets `make kind-load-feed` work (a locally built `:main` is already on the kind node, so no pull is attempted). Once CI has run, envs pin an immutable `sha-xxxxxxx` and this stops mattering.

### 9.2 [templates/_helpers.tpl](charts/feed/templates/_helpers.tpl): labels

Two reusable label sets:

- **`feed.labels`** (put on every object and on the pod template): `app.kubernetes.io/name`, `instance` (the release name), `version` (the image tag), `part-of: resonance`, `managed-by`, plus `helm.sh/chart`.
- **`feed.selectorLabels`** (only `name` and `instance`): used for the Deployment's `spec.selector` and the Service's selector.

The split matters: a Deployment's `spec.selector` is **immutable** after creation. If the selector included the version label, every image bump would try to change it and fail. So the *changing* label (`version`) lives only on `feed.labels`, never in the selector.

### 9.3 [templates/deployment.yaml](charts/feed/templates/deployment.yaml)

Walking through the pod spec top to bottom:

**Identity and scale**
- `replicas: {{ .Values.replicaCount }}`.
- `serviceAccountName: feed` with `automountServiceAccountToken: false`: the pod runs under its own ServiceAccount and does **not** get a Kubernetes API token mounted, because feed never calls the Kubernetes API. If the app is compromised, there's no token to steal.

**Pod-level security context**
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  runAsGroup: 10001
  seccompProfile: { type: RuntimeDefault }
```
Runs as a fixed unprivileged UID (a numeric ID lets the kubelet *verify* non-root; named users can't be verified). `RuntimeDefault` seccomp filters dangerous syscalls.

**Container**
- `image: "{{ repository }}:{{ tag }}"`, `imagePullPolicy` from values.
- Port `8000` named `http` (the app listens on 8000; the Service maps 80 → `http`).
- **Env vars**
  - `LOG_LEVEL`.
  - `POD_NAME` and `POD_NAMESPACE`, injected via the **Downward API** (`fieldRef`).
  - Inside `{{- with .Values.otel.endpoint }}` (rendered only when the endpoint is non-empty):
    - `OTEL_EXPORTER_OTLP_ENDPOINT` = the collector URL.
    - `OTEL_METRIC_EXPORT_INTERVAL` = 10000 ms.
    - `OTEL_RESOURCE_ATTRIBUTES` = `deployment.environment.name=<env>,k8s.namespace.name=$(POD_NAMESPACE),k8s.pod.name=$(POD_NAME)`. The `$(VAR)` syntax is **Kubernetes** env expansion (not Helm, not shell), and only works for variables defined *earlier* in the same `env` list, which is why `POD_NAME`/`POD_NAMESPACE` are declared first.
  - Subtle Helm detail: inside `with`, `.` is rebound to the endpoint string, so the template uses `$.Values...` (the root context) to reach other values.
- **Probes**
  - `livenessProbe`: `GET /healthz` every 10 s. Failure restarts the container.
  - `readinessProbe`: `GET /readyz` every 5 s. Failure removes the pod from the Service. Both endpoints exist in [apps/feed/src/feed/main.py](../apps/feed/src/feed/main.py), and are excluded from telemetry in `telemetry.py` (`_EXCLUDED_URLS = "healthz,readyz"`) so probe noise doesn't pollute the RED dashboard.
- **resources** from values (`toYaml`).
- **Container security context**: `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities.drop: [ALL]`.
- **Writable `/tmp`**: because the root filesystem is read-only, an `emptyDir` named `tmp` is mounted at `/tmp` so Python and friends can still write temp files.
- Optional `nodeSelector` and `tolerations` are emitted only when set (this is how dev pins to the `app` pool).

This hardening set (non-root, read-only root, no capabilities, seccomp, no API token) is close to the Kubernetes "restricted" Pod Security Standard.

### 9.4 [templates/service.yaml](charts/feed/templates/service.yaml)

A `ClusterIP` Service named `feed`: reachable only inside the cluster. Port `80` → pod port named `http` (8000). Using a *named* port means changing `containerPort` in one place is enough. `make k8s-ports` forwards `svc/feed:80` to your laptop's `:5006`.

### 9.5 [templates/serviceaccount.yaml](charts/feed/templates/serviceaccount.yaml)

A ServiceAccount named `feed` with token automounting off and optional annotations. The annotations hook is a placeholder: on EKS, a Pod Identity association binds an IAM role to this account; on AKS, workload identity does the equivalent. Nothing uses it yet because feed doesn't call any cloud APIs.

### 9.6 [Chart.yaml](charts/feed/Chart.yaml)

`version: 0.1.0` (chart version) and `appVersion: "0.1.0"`. These are nominal. The *real* version of what's running is the image tag, which also feeds the `app.kubernetes.io/version` label.

## 10. `observability/`: metrics, logs, traces and dashboards

### 10.1 The design idea: one set of configs, two runtimes

`docker-compose.yml` mounts these files straight into containers:

```yaml
otel-collector: ./platform/observability/otel-collector.yaml -> /etc/otelcol/config.yaml
prometheus:     ./platform/observability/prometheus.yml      -> /etc/prometheus/prometheus.yml
loki:           ./platform/observability/loki.yaml           -> /etc/loki/config.yaml
tempo:          ./platform/observability/tempo.yaml          -> /etc/tempo/config.yaml
grafana:        ./platform/observability/grafana/{provisioning,dashboards}
```

The Kubernetes side builds **ConfigMaps from the very same files** (via Kustomize `configMapGenerator`) and gives the Services the **same names compose uses** (`otel-collector`, `prometheus`, `loki`, `tempo`, `grafana`). Inside the shared configs you'll find hostnames like `tempo:4317`, `loki:3100`, `otel-collector:8889`; those resolve unchanged in both worlds (compose DNS vs. Kubernetes Service DNS within the `observability` namespace).

Cost of this choice: ADR-0005 notes the image tags in `k8s/*.yaml` and `docker-compose.yml` must be bumped together. Benefit: one config, tested on your laptop, deployed to the cluster.

### 10.2 Data flow

```
 feed pods ──OTLP/HTTP :4318──> otel-collector ─┬─ traces ─OTLP/gRPC─> tempo:4317
 (traces, metrics, logs)        (receivers: otlp)│
                                                 ├─ metrics ─> prometheus exporter :8889 <──scraped── prometheus
                                                 │
                                                 └─ logs ─OTLP/HTTP─> loki:3100/otlp

 grafana ──queries──> prometheus:9090 | loki:3100 | tempo:3200
```

The application never talks to Prometheus, Loki or Tempo directly. It only knows one endpoint (the collector). Swapping a backend later means editing the collector's exporters, not the app.

### 10.3 [otel-collector.yaml](observability/otel-collector.yaml)

- **Receivers**: `otlp` on gRPC `0.0.0.0:4317` and HTTP `0.0.0.0:4318`. Feed uses 4318.
- **Processors**: `batch` (groups telemetry into batches before export; cheaper and more reliable).
- **Exporters**:
  - `otlp/tempo` → `tempo:4317`, `tls.insecure: true` (in-cluster, no TLS).
  - `prometheus` → exposes `0.0.0.0:8889` for Prometheus to **scrape**. `resource_to_telemetry_conversion.enabled: true` copies resource attributes (service name, version, git revision, environment, pod…) onto every metric as **labels**. That is how the dashboard can filter by `service_name` and display `service_version` / `vcs_ref_head_revision`.
  - `otlphttp/loki` → `http://loki:3100/otlp` (Loki's native OTLP endpoint).
- **Pipelines**: three independent ones: traces → tempo, metrics → prometheus exporter, logs → loki.
- The "contrib" distribution of the collector (`otel/opentelemetry-collector-contrib:0.111.0`) is used.

### 10.4 [prometheus.yml](observability/prometheus.yml)

- `scrape_interval: 10s`.
- Job `otel-collector-app-metrics` scrapes `otel-collector:8889`: *all application metrics arrive through the collector*, not by scraping the apps.
- Job `prometheus` scrapes itself (`localhost:9090`).
- Note what's **absent**: no node, kubelet, or kube-state-metrics scraping. ADR-0005 lists that as the reason you'd switch to `kube-prometheus-stack` later.

### 10.5 [loki.yaml](observability/loki.yaml)

Single-process Loki: no auth (`auth_enabled: false`), HTTP on 3100, filesystem storage under `/loki`, replication factor 1, in-memory ring. Schema `v13` with the `tsdb` index, 24 h index period. `allow_structured_metadata: true` is **required** for OTLP log ingestion (OTLP attributes are stored as structured metadata). `retention_period: 168h` (7 days) is declared; see the gotcha in [section 15](#15-gotchas-and-things-worth-knowing).

### 10.6 [tempo.yaml](observability/tempo.yaml)

Single-binary Tempo: HTTP API on 3200, OTLP/gRPC receiver on 4317, local filesystem backend (`/var/tempo/wal` and `/var/tempo/blocks`), `block_retention: 168h`. `stream_over_http_enabled: true` lets Grafana stream search results.

### 10.7 Grafana provisioning ([grafana/](observability/grafana/))

Grafana is configured entirely from files; no clicking in the UI.

**[datasources.yaml](observability/grafana/provisioning/datasources/datasources.yaml)** defines three data sources with **fixed UIDs** (`prometheus`, `loki`, `tempo`) so dashboards can refer to them by UID.
- Prometheus is the default.
- Tempo is wired to the others via `jsonData`:
  - `tracesToLogsV2` → from a trace span, jump to the matching logs in Loki (`filterByTraceID: true`, ±1 minute around the span).
  - `serviceMap` → build the service graph from Prometheus data.
  This is what lets you go **metric → trace → log** in the UI.

**[dashboards.yaml](observability/grafana/provisioning/dashboards/dashboards.yaml)** is a *dashboard provider*: it tells Grafana to load every JSON file in `/var/lib/grafana/dashboards` into a folder named "Resonance", with `disableDeletion: true` (so the UI can't delete provisioned dashboards).

**[feed-red.json](observability/grafana/dashboards/feed-red.json)**: dashboard "Feed service: RED" (uid `resonance-feed-red`, auto-refresh 10 s, default range last 15 min). Six panels:

| # | Panel | Type | Data source | Query (abridged) |
|---|---|---|---|---|
| 1 | Request rate (req/s) by status | time series | Prometheus | `sum by (http_status_code) (rate(http_server_duration_milliseconds_count{service_name="feed"}[1m]))` |
| 2 | Error ratio (5xx) | time series | Prometheus | 5xx rate ÷ total rate over 5 m |
| 3 | Latency (ms): p50 / p95 / p99 | time series | Prometheus | `histogram_quantile(0.5/0.95/0.99, sum by (le) (rate(..._bucket[5m])))` |
| 4 | Running version | stat | Prometheus | `sum by (service_version, vcs_ref_head_revision) (rate(..._count[5m]))`, legend `{{service_version}} {{vcs_ref_head_revision}}` |
| 5 | Logs | logs | Loki | `{service_name="feed"}` |
| 6 | Recent traces | table | Tempo | TraceQL search, `service.name = feed`, limit 20 |

Panel 4 is the "did my deploy land?" indicator. It abuses a rate query purely to enumerate which label combinations are currently producing data, and shows the labels as text (`textMode: name`). After a rollout you see the new revision appear (and the old one fade out as its series goes stale). The labels come from the resource attributes the feed image sets (`service.version`, `vcs.ref.head.revision`), carried through by `resource_to_telemetry_conversion`.

Metric names such as `http_server_duration_milliseconds_*` are the older OpenTelemetry HTTP semantic-convention names. If the app's instrumentation is upgraded to emit the newer `http_server_request_duration_seconds_*`, these queries (and the `ms` unit) need updating.

### 10.8 [kustomization.yaml](observability/kustomization.yaml): the cluster entry point

This is the file Argo CD actually builds. Pieces:

- `namespace: observability`: stamps this namespace on every resource.
- `labels: part-of: resonance-observability` with `includeSelectors: false`: adds a label to everything *without* touching selectors (changing selectors would break existing Deployments).
- `resources`: the namespace plus one file per component from `k8s/`.
- `configMapGenerator`: turns the shared config files into ConfigMaps:

| ConfigMap | Source file | Key inside | Mounted by |
|---|---|---|---|
| `otel-collector-config` | `otel-collector.yaml` | `config.yaml` | collector at `/etc/otelcol` |
| `prometheus-config` | `prometheus.yml` | `prometheus.yml` | prometheus at `/etc/prometheus` |
| `loki-config` | `loki.yaml` | `config.yaml` | loki at `/etc/loki` |
| `tempo-config` | `tempo.yaml` | `config.yaml` | tempo at `/etc/tempo` |
| `grafana-datasources` | `datasources.yaml` | `datasources.yaml` | grafana at `/etc/grafana/provisioning/datasources` |
| `grafana-dashboard-providers` | `dashboards.yaml` | `dashboards.yaml` | grafana at `/etc/grafana/provisioning/dashboards` |
| `grafana-dashboards` | `feed-red.json` | `feed-red.json` | grafana at `/var/lib/grafana/dashboards` |

(`config.yaml=otel-collector.yaml` is Kustomize's `key=file` syntax: it renames the file inside the ConfigMap.)

The **hash suffix** Kustomize appends to generated ConfigMap names (`loki-config-8k2m...`) is a feature: edit a config, the name changes, Kustomize rewrites the reference in the Deployment, the pod template changes, and Kubernetes rolls the pod. Without it, config edits would not restart anything.

Because the other `*.yaml` files in this folder (collector, loki...) sit beside a `kustomization.yaml` and are **not listed under `resources`**, Kustomize ignores them as manifests; they're only consumed through the generator.

### 10.9 The per-component manifests ([k8s/](observability/k8s/))

All five follow the same pattern: one `Deployment` (replicas 1) plus one `Service`, with the same hardening approach as the feed chart (non-root numeric UID, `RuntimeDefault` seccomp, no privilege escalation, drop ALL capabilities, read-only root FS where the image tolerates it).

| Component | Image | UID | Ports | Probe | Requests → mem limit | Storage | Notes |
|---|---|---|---|---|---|---|---|
| otel-collector | `otel/opentelemetry-collector-contrib:0.111.0` | 10001 | 4317, 4318, 8889 | tcpSocket on 4318 | 50m/128Mi → 256Mi | none | Config has no `health_check` extension, so "OTLP port open" stands in for health. Default rollout strategy (stateless). |
| prometheus | `prom/prometheus:v2.55.0` | 65534 (`nobody`) | 9090 | `GET /-/ready` | 50m/256Mi → 512Mi | `emptyDir` at `/prometheus` | Args set retention 7d and TSDB path. `fsGroup` so the volume is writable. |
| loki | `grafana/loki:3.2.0` | 10001 | 3100 | `GET /ready` (10 s initial delay) | 50m/128Mi → 384Mi | `emptyDir` at `/loki` | |
| tempo | `grafana/tempo:2.6.1` | 10001 | 3200, 4317 | `GET /ready` (15 s initial delay) | 50m/128Mi → 384Mi | `emptyDir` at `/var/tempo` | `fsGroup: 10001` replaces the `tempo-init` chown container compose needs. |
| grafana | `grafana/grafana:11.3.0` | 472 | 3000 | `GET /api/health` | 50m/128Mi → 256Mi | `emptyDir` at `/var/lib/grafana` | Anonymous **Admin** access, login form disabled, analytics off. Does not set `readOnlyRootFilesystem`. |

Common points:

- **`strategy: Recreate`** on every stateful component (prometheus, loki, tempo, grafana): the old pod stops before the new one starts, so two pods never fight over the same data directory.
- **Storage is `emptyDir`**: data lives and dies with the pod. This is a conscious choice (ADR-0005): environments are destroyed after every session, and persistent volumes would require the EBS CSI driver plus an IAM role. Consequence: **telemetry is lost whenever an observability pod restarts**.
- **`namespace.yaml`** creates the `observability` namespace explicitly (the Application also has `CreateNamespace=true`, which is harmless redundancy).
- **Security warning about Grafana**: anonymous Admin with no login is acceptable only because nothing is exposed except via `kubectl port-forward`. Adding an Ingress without changing this would publish an admin console.

## 11. How the Makefile drives all of this

Relevant section: [Makefile](../Makefile) lines ~101-158.

Variables:

| Variable | Default | Role |
|---|---|---|
| `K8S_ENV` | `local` | Which environment: `local` or `dev`. Picks `envs/$(K8S_ENV)/root.yaml` and the kube-context. |
| `REVISION` | `main` | Git ref the cluster follows. |
| `ARGOCD_CHART_VERSION` | `10.10.5` | Pinned upstream chart. |
| `KIND_CLUSTER` | `resonance` | kind cluster name. |
| `FEED_IMAGE` | `ghcr.io/ovahabpo239/resonance-feed` | Used by `kind-load-feed`. |
| `KUBE_CONTEXT_local` / `_dev` | `kind-resonance` / `eks-resonance-dev` | Context names; `KUBE_CONTEXT = $(KUBE_CONTEXT_$(K8S_ENV))` selects one. |
| `KUBECTL` | `kubectl --context $(KUBE_CONTEXT)` | Every kubectl call is context-pinned, so these targets can never hit the wrong cluster by accident. |

Targets:

- **`kind-up`**: `kind create cluster --config platform/kind/cluster.yaml`.
- **`kind-down`**: `kind delete cluster --name resonance`.
- **`kind-load-feed`**: builds `apps/feed/Dockerfile` locally (passing `GIT_SHA`), tags it `ghcr.io/ovahabpo239/resonance-feed:main`, and `kind load docker-image`s it into the cluster. Use it to test the chart before CI has pushed an image, or from a branch.
- <a id="gitops-up"></a>**`gitops-up`**:
  1. Fails fast if `K8S_ENV` isn't `local` or `dev` (empty `KUBE_CONTEXT`).
  2. `helm upgrade --install argocd ...`: installs/updates Argo CD with [argocd/values.yaml](argocd/values.yaml), waiting up to 10 min.
  3. `kubectl apply -f platform/envs/$(K8S_ENV)/root.yaml`: creates the root Application.
  4. **Always** `kubectl patch application root` to set `targetRevision` (on the root's source) *and* a Helm `targetRevision` parameter to `$(REVISION)`. It runs unconditionally so that `REVISION=main` genuinely *resets* a cluster that was previously pointed at a branch. (Without the always-run patch, `kubectl apply` of the file would reset the root's own revision but `helm.parameters` set earlier could linger.)
- <a id="k8s-ports"></a>**`k8s-ports`**: starts three `kubectl port-forward`s in parallel and waits:
  - `svc/argocd-server` (namespace `argocd`) port 80 → **localhost:5004**
  - `svc/grafana` (namespace `observability`) port 3000 → **localhost:5005**
  - `svc/feed` (namespace `resonance`) port 80 → **localhost:5006**
  Ctrl-C stops all three. Same commands on kind and EKS. These ports are part of the repo-wide plan in [docs/ports.md](../docs/ports.md) and the header of `docker-compose.yml` (5004-5006 reserved for cluster port-forwards).
- **`argocd-password`**: decodes `argocd-initial-admin-secret` for the `admin` user.
- <a id="platform-lint"></a>**`platform-lint`** (what CI runs; needs `helm` and `kubeconform`):
  1. `helm lint --strict` on both charts (`--set env=local` for the app-of-apps chart).
  2. For each env: render the app-of-apps chart with `envs/$env/apps.yaml` and the feed chart with `envs/$env/feed.yaml`, and pipe the output into `kubeconform -strict`.
  3. `kubectl kustomize platform/observability | kubeconform`.
  4. Validate each `envs/*/root.yaml` directly.
  `kubeconform` is configured with the default Kubernetes schemas **plus** the datreeio CRDs catalog, which is how it can validate Argo CD `Application` objects.

## 12. CI: the two workflows that touch `platform/`

### 12.1 [.github/workflows/platform.yml](../.github/workflows/platform.yml): validate

Triggers on PRs and pushes to `main` that touch `platform/**` (or the workflow file). Installs Helm v4.3.1 and kubeconform v0.8.0 and runs `make platform-lint`. `concurrency` cancels superseded runs on the same ref. It only needs `contents: read`.

### 12.2 [.github/workflows/feed.yml](../.github/workflows/feed.yml): build, ship, record

The `deploy` job is the one that writes into `platform/`:

- Runs only on pushes (merges to main), after the `image` job succeeds.
- Needs `contents: write` to push a commit. A `concurrency` group `feed-deploy` with `cancel-in-progress: false` **queues** deploys instead of cancelling them.
- For each `platform/envs/*/feed.yaml`:
  - Reads the current tag with `yq`.
  - **Staleness guard**: if the file already runs a `sha-*` tag whose commit is a *descendant* of this run's commit (`git merge-base --is-ancestor`), skip it. A slow run for an older commit therefore cannot roll back a newer deploy.
  - Otherwise `yq -i '.image.tag = "sha-xxxxxxx"'`.
- If nothing changed, exit successfully. Otherwise commit `chore(deploy): feed sha-xxxxxxx` as `github-actions[bot]` and push, with up to 3 retries (fetch + hard reset to `origin/main` between attempts, to survive races with other merges).
- Commits pushed with the workflow `GITHUB_TOKEN` don't trigger other workflows, so this can't loop. A side effect is that the deploy commit itself is **not** linted by `platform.yml`; it only changes one scalar, so the risk is small.

The `image` job (not in `platform/` but part of the story) lints, tests, builds with `GIT_SHA`, scans with Trivy, pushes `:sha-<7>` and `:main` with SBOM + max provenance, and signs the digest with keyless cosign.

## 13. End-to-end walkthroughs

### 13.1 First-time local bring-up

```bash
make kind-up           # 1. cluster "resonance" exists; kubectl context kind-resonance
make gitops-up         # 2. Argo CD installed; root applied; patched to REVISION=main
                       # 3. (automatic) root renders argocd/apps with env=local
                       #    -> Application feed          -> ns resonance
                       #    -> Application observability -> ns observability
                       # 4. (automatic) both sync; pods start; Services appear
make k8s-ports         # 5. localhost:5004 Argo CD, :5005 Grafana, :5006 feed
make argocd-password   # 6. log in to Argo CD as admin
curl localhost:5006/v1/ping
```

### 13.2 What a deploy looks like, minute by minute

| When | What happens |
|---|---|
| t = 0 | PR touching `apps/feed` merges to `main`. |
| t ≈ minutes | `feed.yml` image job finishes: `ghcr.io/ovahabpo239/resonance-feed:sha-a1b2c3d` is pushed and signed. |
| next | `deploy` job commits `chore(deploy): feed sha-a1b2c3d` changing `image.tag` in `envs/local/feed.yaml` and `envs/dev/feed.yaml`. |
| t + ≤ ~70 s | Argo CD's next reconcile (60 s + ≤10 s jitter) sees the new commit on `main`, re-renders the `feed` Application, finds the Deployment's image changed, syncs. |
| next | Kubernetes rolling update: new pod starts, `/readyz` passes, old pod terminates. |
| next | New pod's telemetry reports `vcs.ref.head.revision = a1b2c3d...`; within one scrape interval the Grafana "Running version" panel shows it. |

### 13.3 Rollback

`git revert <the chore(deploy) commit>` and push to `main`. Argo CD rolls the image back. No special tooling. (Because the staleness guard compares ancestry, a later automated deploy for an older code commit won't undo your revert unless that older commit is genuinely newer than what's running.)

### 13.4 Trying a branch without merging

```bash
make kind-load-feed                 # build the branch's image as :main into kind
make gitops-up REVISION=my-branch   # root + children now follow my-branch
# ...iterate, push commits to my-branch; Argo CD follows...
make gitops-up                      # back to main
```
This works because the chart's `tag: main` + `IfNotPresent` finds the locally loaded image. (Any `sha-` tag CI wrote to the branch's `feed.yaml` would not be available locally, so keep `tag: main` for this flow.)

### 13.5 Same thing on EKS

```bash
make cloud-up cloud-creds           # Terraform creates EKS; kubeconfig context eks-resonance-dev
make gitops-up K8S_ENV=dev
make k8s-ports K8S_ENV=dev
make cloud-down                     # destroys everything, Argo CD and apps included
```
Nothing in `platform/` creates cloud resources (no load balancers or volumes), so `cloud-down` leaves nothing behind.

## 14. Cross-file couplings (things that must change together)

| If you change… | …also check |
|---|---|
| Image tags in `observability/k8s/*.yaml` | `docker-compose.yml` (same tags on purpose) |
| A hostname/port in a shared observability config (e.g. Tempo's OTLP port) | The matching `k8s/*.yaml` containerPort + Service, the compose file, and the other configs that reference it (collector exporters, Grafana datasources) |
| Service names in `observability/k8s/*.yaml` | Every shared config that references them by hostname (and `otel.endpoint` in the feed chart) |
| `otel.endpoint` namespace/name | The collector Service (`otel-collector` in `observability`) |
| Repo URL / owner | `repoURL` in **both** `envs/*/root.yaml` **and** `argocd/apps/values.yaml`; `image.repository` in `charts/feed/values.yaml`; `FEED_IMAGE` in the Makefile |
| `KIND_CLUSTER` / the EKS cluster name | `KUBE_CONTEXT_local` / `KUBE_CONTEXT_dev` in the Makefile, `name:` in `kind/cluster.yaml` |
| Feed's container port 8000 | `containerPort` in `deployment.yaml` (Service uses the *named* port, so it follows automatically), the app's Dockerfile and compose file |
| Ports 5004/5005/5006 | `Makefile` (`k8s-ports`), `argocd/values.yaml` (`global.domain`), `docs/ports.md`, `docker-compose.yml` header |
| Metric/label names in the app's telemetry | `observability/grafana/dashboards/feed-red.json` queries |
| `image.tag` format (`sha-<7>`) | `feed.yml`'s staleness guard strips the `sha-` prefix and treats the rest as a commit; keep the format |
| EKS node-group labels (`pool: app`) | `envs/dev/feed.yaml` `nodeSelector` |

## 15. Gotchas and things worth knowing

1. **The variable is `K8S_ENV`, not `ENV`.** `make gitops-up ENV=dev` would silently ignore `ENV` and run against the **local** (kind) context, since `K8S_ENV` defaults to `local`. Always write `K8S_ENV=dev`.
2. **Three places hold the repo URL.** Both `root.yaml` files hardcode it (Argo CD reads root *before* any chart is rendered, so it can't come from a value), and `argocd/apps/values.yaml` repeats it for the children.
3. **`REVISION` only changes the live cluster, not Git.** The patch edits the Application object in the cluster. The checked-in `root.yaml` always says `main`. Re-running `make gitops-up` re-applies `root.yaml` (reverting to main) and then re-patches to whatever `REVISION` is, which is why the patch is unconditional.
4. **selfHeal fights `kubectl edit`.** If you hand-edit a managed object, Argo CD reverts it at the next reconcile. To experiment, change Git (or pause sync on that Application).
5. **prune + finalizer = deleting is dangerous.** Deleting the `root` Application cascades to `feed` and `observability` and everything they own (including the namespaces' contents).
6. **Public repo and public image are required.** Argo CD has no repo credential and the clusters have no pull secret. The first push creates the GHCR package as private; make it public once (README "One-time setup").
7. **`emptyDir` means amnesia.** Restarting Prometheus, Loki, Tempo or Grafana drops their data. Dashboards survive (they are provisioned from files), but history doesn't.
8. **Loki retention.** `retention_period: 168h` is set in `limits_config`, but, to the best of my knowledge, Loki only enforces retention when the compactor's retention is enabled, which this config doesn't do. It's harmless while storage is ephemeral, but it will not delete anything on its own if you later add persistent volumes.
9. **Dashboard metric names are tied to the instrumentation version.** See the note under [10.7](#107-grafana-provisioning-grafana).
10. **`app.kubernetes.io/version` is the image tag.** Tags like `sha-a1b2c3d` are valid label values; a very long or oddly formatted tag would not be.
11. **Single replica, no disruption budget.** A node drain or a rollout can briefly take feed to zero if the new pod isn't ready. Fine for dev; revisit before anything user-facing.
12. **Chart/appVersion `0.1.0` never changes.** Don't rely on them to tell what's deployed; look at the image tag or the Grafana panel.
13. **Argo CD refresh cadence.** 60 s polling is the *only* trigger (no webhook can reach a laptop or a private cluster). To force it, click "Refresh"/"Sync" in the UI.

## 16. What is deliberately not here yet

These are conscious omissions (most are discussed in ADR-0005's alternatives table), useful to know before you wonder where something is:

- **Ingress / load balancers / TLS.** Access is by port-forward only. Adding them also means putting auth in front of Grafana.
- **Persistent storage** for the observability stack (needs the EBS CSI driver and an IAM role).
- **Cluster-level metrics** (node, kubelet, kube-state-metrics) and **alerting rules**; the trigger for moving to `kube-prometheus-stack`.
- **Autoscaling**: no HPA for feed, and no Cluster Autoscaler/Karpenter yet (the EKS module notes it "belongs to `platform/`"; see also [infra/README.md](../infra/README.md)).
- **Policies** (Kyverno etc.): the spec mentions `platform/` holding them, but none exist yet.
- **NetworkPolicies, PodDisruptionBudgets, ResourceQuotas, custom Argo `AppProject`s.**
- **Secrets management.** There are no secrets in `platform/` at all today (feed needs none; Argo CD generates its own admin password).
- **Image Updater.** CI writes tags into Git instead; an Argo CD Image Updater would be worth it with many services.
- **Other apps.** Only `feed` is deployed. The `web` app currently runs only under docker compose.

## 17. Recipes: how to change things

**Change feed's resources or log level in dev only**: edit `envs/dev/feed.yaml` (e.g. `logLevel: DEBUG`, or a `resources:` block). Merge; Argo CD applies.

**Add an env var to the feed container**: add a value in `charts/feed/values.yaml`, then reference it in `templates/deployment.yaml`. Remember `kubeconform` and `helm lint --strict` must pass (`make platform-lint`).

**Scale feed**: `replicaCount: 3` in the right `envs/<env>/feed.yaml`. (Mind the t3.medium pod and memory limits in dev.)

**Edit a Prometheus/Loki/Tempo/collector config**: edit the file under `observability/`. It changes both compose (restart the container) and the cluster (the ConfigMap hash changes, so the pod rolls automatically).

**Add a Grafana dashboard**: put the JSON in `observability/grafana/dashboards/`, **and** add it to `configMapGenerator` → `grafana-dashboards` → `files` in `kustomization.yaml` (compose picks it up from the mounted directory by itself; Kubernetes does not).

**Bump an observability image**: change the tag in `observability/k8s/<x>.yaml` **and** `docker-compose.yml`.

**Add a new environment (e.g. `staging`)**: create `envs/staging/{root,apps,feed}.yaml` (copy `dev`, set `env: staging`, adjust `environment:` and any selectors), add `staging` to the Makefile (`KUBE_CONTEXT_staging`, the `for env in local dev` loops in `platform-lint`), and the CI deploy job already loops over `platform/envs/*/feed.yaml`, so it picks the new environment up automatically.

**Upgrade Argo CD**: change `ARGOCD_CHART_VERSION` in the Makefile and re-run `make gitops-up`.

**Look at what Argo CD would render, locally**:
```bash
helm template root platform/argocd/apps -f platform/envs/local/apps.yaml
helm template feed platform/charts/feed -f platform/envs/local/feed.yaml
kubectl kustomize platform/observability
```
These are the exact commands `make platform-lint` pipes to kubeconform, and are the fastest way to debug a template.

**Tear down**: `make kind-down` for local, `make cloud-down` for dev (the cluster takes Argo CD and all workloads with it).
