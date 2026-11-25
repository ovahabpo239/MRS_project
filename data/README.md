# data

The batch data platform (Phase 1): a medallion lakehouse of Delta tables, built with Spark and
dbt. Bronze is raw and append-only, silver is cleaned and typed, gold is the analytics and
ML-ready marts. See [docs/spec.md](../docs/spec.md) section 7.1.

Everything runs locally first, against an S3-compatible store ([RustFS](https://rustfs.com), the
`lake` compose service) using the same `s3a://` paths AWS S3 will use later. Spark, Delta and dbt
run in the `data` image because the host has no Java.

## Run it

```bash
make lake-up       # local S3 on :5019, console on http://localhost:5020 (resonance / resonance-local-only)
make data-smoke    # Spark writes a Delta table to the lake and reads it back through the metastore
make data-fma-bronze   # download FMA metadata (342 MiB, SHA-1 checked), land it, load bronze (~3 min)
make data-dbt ARGS="build"
make data-lint     # ruff + mypy, in the image
make data-test     # pytest in the image; the landing test needs the lake and is skipped without it
make lake-reset    # deletes the lake and the metastore (only those two volumes)
```

To try the pipeline without the big download, write the synthetic sample archive (same shape as the
real files) and point the download step at it. Paths are the ones inside the container, where
this folder is `/app`:

```bash
docker compose --profile lake run --rm data fma sample --out /app/fma_sample.zip
make data-fma-bronze SOURCE=/app/fma_sample.zip SHA1=none
```

The first `docker compose --profile lake build data` takes a few minutes and produces a
4 GB image: it contains PySpark, dbt and the Delta/S3A jars (resolved once at build time, so
jobs start offline). Spark's driver is capped at 3 GB (`SPARK_DRIVER_MEMORY`).

## Layout

| Path | Contents |
|---|---|
| `src/resonance_data/spark.py` | `get_spark()` (Delta + S3A + optional Hive metastore) and `lake_uri()` |
| `src/resonance_data/cli.py` | `python -m resonance_data {smoke,dbt,fma}` |
| `src/resonance_data/lake_s3.py` | plain S3 access (raw landing copies, test buckets) |
| `src/resonance_data/fma/` | `download.py` (fetch, verify, land), `csvflat.py` (multi-row headers), `bronze.py`, `sample.py` (synthetic archive) |
| `src/resonance_data/packages.py` | Maven coordinates; keep `HADOOP_VERSION` equal to the Hadoop version bundled in pyspark |
| `dbt/` | `profiles.yml` and the `resonance` dbt project (gold models) |
| `tests/` | pytest |

This is its own uv project (`pyproject.toml`, `uv.lock`), outside the root workspace, so the
Python service CI does not install Spark.

## How the pieces fit

- `get_spark()` reads the endpoint and credentials from env vars (`S3_ENDPOINT`, `AWS_*`). With
  `S3_ENDPOINT` unset it talks to AWS S3 using the default credential chain, which is how the same
  code will run on EMR Serverless.
- dbt runs inside the Spark session that `get_spark(hive=True)` creates (`dbt-spark`, method
  `session`), so there is no Thrift server. Table definitions live in a Derby metastore on the
  `spark-metastore` volume; a single connection means dbt uses one thread.
- The container user cannot write to the bind-mounted source tree, so dbt logs and `target/` go to
  `/tmp/dbt` inside the container.
