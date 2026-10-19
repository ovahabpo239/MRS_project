# platform

Everything that runs inside Kubernetes, delivered by Argo CD from this repository
([ADR-0005](../docs/adr/0005-gitops-delivery.md)). The same layout serves the local kind cluster
and dev on EKS; environments differ only by values.

```
platform/
  argocd/values.yaml          values for the upstream argo-cd chart (installed by make gitops-up)
  argocd/apps/                app of apps: one Application per component, for a given env
  envs/<env>/root.yaml        root Application of the environment
  envs/<env>/apps.yaml        values for argocd/apps
  envs/<env>/feed.yaml        values for charts/feed; CI rewrites image.tag on every merge to main
  charts/feed/                Helm chart of the feed service
  observability/              config shared with docker compose, plus kustomization.yaml and k8s/
  kind/cluster.yaml           the local cluster
```

## How a commit reaches the cluster

1. A merge to main that touches `apps/feed` runs `.github/workflows/feed.yml`: lint and tests,
   image build, Trivy scan, push to `ghcr.io/ovahabpo239/resonance-feed:sha-<7>` with SBOM and
   provenance, cosign signature.
2. The same workflow commits `image.tag: sha-<7>` to `platform/envs/*/feed.yaml`.
3. Argo CD in every cluster that follows `main` sees the commit within about a minute and rolls
   the Deployment.
4. The new pods report `vcs.ref.head.revision` to the collector, and the Grafana dashboard
   "Feed service: RED" shows the new revision under "Running version".

Rollback is a revert of the deploy commit.

## Local (kind)

Needs Docker, [kind](https://kind.sigs.k8s.io/), `kubectl` and `helm`.

```bash
make kind-up                  # cluster "resonance", context kind-resonance
make gitops-up                # Argo CD, then the root app of envs/local
make k8s-ports                # Argo CD :5004, Grafana :5005, feed :5006 (Ctrl-C to stop)
make argocd-password          # user admin
curl localhost:5006/v1/ping
make kind-down
```

To try changes from a branch before merging, point the cluster at it and use a locally built
image: `make kind-load-feed && make gitops-up REVISION=<branch>`. Run `make gitops-up` again
(REVISION defaults to `main`) to go back.

## dev (EKS)

After `make cloud-up cloud-creds` (see [infra/README.md](../infra/README.md)):

```bash
make gitops-up K8S_ENV=dev
make k8s-ports K8S_ENV=dev
```

Nothing here creates cloud resources: no load balancers, no volumes. `make cloud-down` removes
everything with the cluster.

## Checks

`make platform-lint` (needs `helm` and [kubeconform](https://github.com/yannh/kubeconform))
lints the charts and validates every rendered manifest, including the Argo CD Applications,
against their schemas. `.github/workflows/platform.yml` runs it on every change here.

## One-time setup

- The first image push creates the GHCR package `resonance-feed` as private. Make it public once
  (GitHub > Packages > resonance-feed > Package settings > Change visibility), so the clusters
  can pull it without a secret.
- Image tags in `observability/k8s/` and `docker-compose.yml` are the same on purpose; bump them
  together.
