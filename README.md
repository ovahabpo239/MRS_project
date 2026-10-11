# Resonance

Conversational, explainable music discovery, built as an end-to-end AI / ML / data / platform
portfolio system. The full design is in [docs/spec.md](docs/spec.md).

> **Status:** Phase 0 (walking skeleton). Most of the system described in the spec does not exist yet.

## Quick start

```bash
make up        # local stack: feed service + OpenTelemetry, Prometheus, Loki, Tempo, Grafana
make test      # unit tests
make lint      # ruff + mypy
make down      # stop everything
```

Grafana runs on <http://localhost:3000>, the feed service on <http://localhost:8000/docs>.

## Layout

| Path | Contents |
|---|---|
| `apps/` | Application services (`feed` first) |
| `ml/` | Training code, configs, evaluation |
| `data/` | dbt project, Airflow DAGs, streaming jobs, schemas |
| `llm/` | Prompts, eval sets, fine-tuning, RAG pipeline |
| `platform/` | Helm charts, Argo CD apps, policies, local observability config |
| `infra/` | Terraform modules and environments, Ansible playbooks |
| `sim/` | User behavior simulator and load-test scenarios |
| `docs/` | Spec, ADRs, runbooks, postmortems |

Architecture decisions are recorded in [docs/adr/](docs/adr/).
