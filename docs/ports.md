# Ports

Host ports for the local stack, as defined in [docker-compose.yml](../docker-compose.yml). Container ports are unchanged; services reach each other by name on the container port.

## 5000-5009: UIs opened manually

| Host port | Container port | Service | Link | Notes |
| --- | --- | --- | --- | --- |
| 5000 | 3000 | Grafana | [localhost:5000](http://localhost:5000) | |
| 5001 | 8000 | feed API | [localhost:5001/healthz](http://localhost:5001/healthz) | Health probe |
| 5002 | 9090 | Prometheus | [localhost:5002](http://localhost:5002) | |
| 5003 | 3000 | web app | [localhost:5003](http://localhost:5003) | `--profile web` / `make web-up` |
| 5004 | - | Argo CD | - | Reserved, not yet in use |

## 5010+: everything else

| Host port | Container port | Service | Link | Notes |
| --- | --- | --- | --- | --- |
| 5010 | 4317 | OTel collector | - | OTLP gRPC |
| 5011 | 4318 | OTel collector | - | OTLP HTTP (accepts POST only) |
| 5012 | 3100 | Loki | [localhost:5012/ready](http://localhost:5012/ready) | Readiness probe |
| 5013 | 3200 | Tempo | [localhost:5013/ready](http://localhost:5013/ready) | Readiness probe |
| 5014 | 5432 | Postgres (pgvector) | - | `--profile data` |
| 5015 | 6379 | Redis | - | `--profile data` |
| 5016 | 1025 | Mailpit | - | SMTP |
| 5017 | 8025 | Mailpit | [localhost:5017](http://localhost:5017) | Web UI |
| 5018 | 5432 | web-db (Postgres) | - | Web app accounts and sessions |

Rows without a link are not HTTP UIs (databases, SMTP, gRPC) or only accept POST.

## Outside the compose stack

Runs as a standalone container, not defined in this repo.

| Host port | Container port | Service | Link | Notes |
| --- | --- | --- | --- | --- |
| 9443 | 9443 | Portainer | [localhost:9443](https://localhost:9443) | HTTPS with a self-signed certificate, so the browser shows a warning |
