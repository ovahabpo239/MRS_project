.PHONY: up down test lint fmt openapi logs

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
