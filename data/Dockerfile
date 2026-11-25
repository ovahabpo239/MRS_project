FROM python:3.12-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-17-jre-headless procps \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --create-home --shell /usr/sbin/nologin spark \
    && mkdir -p /opt/ivy /var/metastore /app \
    && chown -R spark /opt/ivy /var/metastore /app

COPY --from=ghcr.io/astral-sh/uv:0.11.26 /uv /usr/local/bin/uv

ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    PATH=/opt/venv/bin:$PATH \
    PYTHONPATH=/app/src \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SPARK_IVY_DIR=/opt/ivy \
    SPARK_METASTORE_DIR=/var/metastore

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

# Resolve the Delta and S3A jars once, so jobs start without network access.
COPY src/resonance_data/__init__.py src/resonance_data/packages.py src/resonance_data/
RUN python -c "\
from delta import configure_spark_with_delta_pip; \
from pyspark.sql import SparkSession; \
from resonance_data.packages import EXTRA_PACKAGES; \
b = SparkSession.builder.master('local[1]').config('spark.jars.ivy', '/opt/ivy'); \
configure_spark_with_delta_pip(b, extra_packages=EXTRA_PACKAGES).getOrCreate().stop()" \
    && chown -R spark /opt/ivy

COPY src ./src
COPY dbt ./dbt
COPY tests ./tests

# Compose bind-mounts the host's data/ over /app, which the container user cannot write to, so
# tool output (dbt logs and target, caches) goes to /tmp.
ENV DBT_LOG_PATH=/tmp/dbt/logs \
    DBT_TARGET_PATH=/tmp/dbt/target \
    MYPY_CACHE_DIR=/tmp/mypy \
    RUFF_CACHE_DIR=/tmp/ruff \
    PYTEST_ADDOPTS="-p no:cacheprovider"

USER spark
ENTRYPOINT ["python", "-m", "resonance_data"]
