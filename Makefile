.PHONY: up down test lint fmt openapi logs web-dev web-up web-lint web-test web-build

COMPOSE ?= docker compose

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
web-dev:
	npm --prefix apps/web run dev

web-up:
	$(COMPOSE) --profile web up -d --build web

web-lint:
	npm --prefix apps/web run lint
	npm --prefix apps/web run typecheck
	npm --prefix apps/web run format:check

web-test:
	npm --prefix apps/web test

web-build:
	npm --prefix apps/web run build
