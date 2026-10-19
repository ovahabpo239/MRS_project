# ADR-0005: GitOps delivery with Argo CD, CI-written image tags and shared observability config

- **Status:** accepted
- **Date:** 2026-10-19

## Context

Phase 0 ends when "a commit reaches the cluster and shows up in dashboards", first on a local
kind cluster and then on EKS (ADR-0002, ADR-0004). Until now nothing shipped to Kubernetes:
the feed service had no CI, no image registry and no chart, and observability only ran in docker
compose. The clusters are torn down after every session (ADR-0003), so whatever runs in them has
to come back from one command, and dev on EKS runs on t3.medium nodes, which leaves little
room for platform components.

## Decision

- **Argo CD, pull-based.** `make gitops-up` installs the upstream argo-cd chart (pinned, slim
  values in `platform/argocd/values.yaml`) and applies one root Application. From then on Git is
  the only way anything changes in the cluster: automated sync, prune and self-heal.
- **App of apps as a Helm chart.** `platform/argocd/apps` renders one Application per component
  for the `env` it is given. Each environment is a directory, `platform/envs/<env>/`, holding
  its root Application and values files. Local and dev therefore differ only by values, which
  is what ADR-0002 requires.
- **CI writes the image tag into Git.** On every merge to main, `.github/workflows/feed.yml`
  builds, scans (Trivy), pushes `ghcr.io/<owner>/resonance-feed:sha-<7>` with SBOM and
  provenance, signs it with keyless cosign, and then commits the new tag to
  `platform/envs/*/feed.yaml`. That commit is the deploy record; reverting it is the rollback.
- **Observability in the cluster reuses the compose files.** `platform/observability` is a
  kustomization whose ConfigMaps come from the same `otel-collector.yaml`, `prometheus.yml`,
  `loki.yaml`, `tempo.yaml` and Grafana provisioning that compose mounts. The Services are named
  like the compose services, so the hostnames inside those files resolve unchanged. Storage is
  `emptyDir`.
- **No ingress yet.** Argo CD, Grafana and feed are reached through `make k8s-ports`
  (`kubectl port-forward` to 5004, 5005 and 5006), identically on kind and EKS.
- **Dev keeps one app node.** `app_min_count` defaults to 1 in `infra/terraform/aws/envs/dev`:
  one t3.medium (17 pods, about 3.3 GiB) cannot hold kube-system, Argo CD, observability and the
  apps. This raises the cost of an hour of dev by about USD 0.04.

## Alternatives considered

| Option | Why not (or when we would choose it instead) |
|---|---|
| Push-based CD (`helm upgrade` from CI) | CI would need cluster credentials, and nothing would notice or undo drift. Still the simpler choice for a single throwaway cluster. |
| Argo CD Image Updater | Watches the registry and writes tags back itself. One more controller to run and configure, and the deploy history is less obvious than a plain commit. Worth it once there are many services. |
| Upstream charts for observability (kube-prometheus-stack, loki, tempo) | Cluster-level metrics and HA, but several hundred MiB more on small nodes and a second copy of every config. We switch when node and kube-state metrics or alerting rules are needed. |
| Persistent volumes for Prometheus, Loki and Tempo | Needs the EBS CSI driver and a Pod Identity role on EKS. Pointless while every environment is destroyed at the end of the day. |
| Ingress or a LoadBalancer Service | Costs money on EKS (an ELB per hour), creates resources outside Terraform that nuke.sh has to find, and needs TLS and auth in front of Grafana. Comes with CloudFront and WAF. |
| ApplicationSet instead of an app-of-apps chart | Fits many clusters or generated environments; with two hand-made environments a small chart is easier to read. |

## Consequences

- A commit to `apps/feed` reaches every cluster that follows `main` within about a minute of
  the deploy commit (Argo CD polls every 60 s; no webhook can reach a laptop or a private cluster).
- The repository and the GHCR package must stay public, or Argo CD needs a repo credential and
  the clusters an image pull secret.
- Image tags in `platform/observability/k8s/` and `docker-compose.yml` must be bumped together.
- The Grafana "Running version" panel groups by `vcs_ref_head_revision`, which the feed image
  sets from its build commit, so a deploy is visible in the dashboard.
- Telemetry is lost whenever an observability pod restarts. Acceptable for dev, not for prod.
