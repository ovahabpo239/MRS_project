# syntax=docker/dockerfile:1.7
# Build context is the repository root so the workspace lockfile is reused:
#   docker build -f apps/feed/Dockerfile .

FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.11.26 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app

# Dependencies first: cached until a pyproject or the lockfile changes.
COPY pyproject.toml uv.lock ./
COPY apps/feed/pyproject.toml apps/feed/pyproject.toml
RUN uv sync --frozen --no-dev --no-editable --no-install-workspace --package feed

# Then the service itself, installed (not editable) into the venv.
COPY apps/feed/src apps/feed/src
RUN uv sync --frozen --no-dev --no-editable --package feed

FROM python:3.12-slim AS runtime
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app
COPY --from=build --chown=10001:10001 /app/.venv /app/.venv
# Commit the image was built from (CI passes it); exported as a telemetry resource attribute.
# Declared late so a new commit does not invalidate the cached layers above.
ARG GIT_SHA=""
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    GIT_SHA=$GIT_SHA
USER 10001:10001
EXPOSE 8000
CMD ["uvicorn", "feed.main:app", "--host", "0.0.0.0", "--port", "8000"]
