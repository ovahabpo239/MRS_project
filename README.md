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

All host ports are in the 5000 range. The first ten are the UIs you open by hand; the rest are
plumbing.

| Port | Service | |
|---|---|---|
| 5000 | Grafana | <http://localhost:5000> |
| 5001 | Feed API | <http://localhost:5001/docs> |
| 5002 | Prometheus | <http://localhost:5002> |
| 5003 | Web app | <http://localhost:5003> (`make web-up`) |
| 5004 | Argo CD | reserved |
| 5010 / 5011 | OTLP gRPC / HTTP | collector |
| 5012 / 5013 | Loki / Tempo | |
| 5014 / 5015 | Postgres / Redis | `--profile data` |

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
