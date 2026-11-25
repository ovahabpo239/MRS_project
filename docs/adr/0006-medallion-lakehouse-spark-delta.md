# ADR-0006: Medallion lakehouse on Delta, built with Spark and dbt, proven locally on an S3 clone

- **Status:** accepted
- **Date:** 2026-10-20

## Context

Phase 1 builds the batch data platform: MusicBrainz, ListenBrainz and FMA data in bronze, silver
and gold layers, with tests and orchestration. ADR-0002 says to prove each flow locally before
spending cloud credit, and ADR-0003 says the cloud is destroyed after every session, so the lake's
code has to run unchanged against a throwaway local store and, later, against S3. The workstation
has no Java and about 4 GB of free RAM next to the rest of the stack.

## Decision

- **Layers.** Bronze is raw and append-only, tagged with `_batch_id`, `_source_file` and
  `_ingested_at`. Silver is typed and deduplicated. Gold is built by dbt. All three are Delta
  tables in one bucket: `s3a://lake/{bronze,silver,gold}/<source>/<table>`. Raw downloads are
  kept next to bronze under `bronze/<source>/_raw/<batch id>/`, so every row traces back to the
  exact bytes it came from. A batch id is the SHA-1 prefix of the downloaded file.
- **Spark does bronze and silver; dbt-spark does gold.** dbt runs in the same Spark session as
  the Python jobs (method `session`, started by `python -m resonance_data dbt`), so there is no
  Thrift server to run. Table definitions are kept in a persistent Derby metastore, which forces
  dbt to a single thread.
- **Idempotent loads.** Bronze replaces only the rows of the batch it is loading
  (`replaceWhere _batch_id = ...`); re-running a batch changes nothing and a new batch is added
  next to the old ones.
- **Local object store: RustFS** (Apache-2.0, single container, S3 API and a console) on ports
  5019 and 5020. Code only sees `s3a://` paths; the endpoint comes from `S3_ENDPOINT` and is
  unset on AWS, where the default credential chain applies.
- **Everything Spark runs in one container image** (`data/Dockerfile`: JRE 17, PySpark, Delta,
  the S3A jars resolved at build time, dbt). The Python project in `data/` is outside the root uv
  workspace so the service CI does not install Spark.

## Alternatives considered

| Option | Why not (or when we would choose it instead) |
|---|---|
| Iceberg instead of Delta | Wider engine support (Trino, Snowflake, Athena, Flink write paths). The spec's stack is Spark-centred and Delta's tooling there is the most mature, and Iceberg stays readable from Delta through UniForm. We would choose Iceberg if a non-Spark engine had to write to the lake. |
| DuckDB with dbt-duckdb | Much lighter and faster for a laptop, but it would leave Spark out of the project and the Data Engineer path with it. We would choose it for a small team without a cluster. |
| MinIO as the local S3 | The first choice, but MinIO no longer publishes container images (Docker Hub has none; the quay.io image has no usable tag), so it cannot be pulled reproducibly. RustFS gave the same workflow. SeaweedFS is the fallback if RustFS causes trouble. |
| Moto or LocalStack for S3 | Emulators for tests, not stores you can browse and keep data in between runs. |
| dbt over the Spark Thrift Server | A second long-running JVM for no benefit at this size. We would run it on a shared cluster with many users. |
| Landing raw files with Spark only (no boto3) | Binary zip files do not fit Spark's readers; plain S3 puts keep the raw copy byte-identical. |

## Consequences

- The data image is about 4 GB (PySpark, dbt and the AWS SDK bundle). Jobs start offline once it is
  built, but the first build takes minutes.
- Spark's driver is capped at 3 GB (`SPARK_DRIVER_MEMORY`), which bounds the size of single
  files that can be parsed in one go. `features.csv` (about 950 MB, 518 columns) is deferred.
- Gold lives in a Derby metastore on a Docker volume, so `make lake-reset` removes both.
- In the cloud the lake bucket must live in the permanent Terraform layer (ADR-0003 deferred this
  decision to Phase 1), otherwise every teardown deletes the data. That belongs to the
  cloud pass of Phase 1, not to this slice.
- Image tags and the jar versions (`HADOOP_VERSION` in `packages.py`, the PySpark and Delta
  versions in `pyproject.toml`) move together; `HADOOP_VERSION` has to equal the Hadoop version that
  PySpark bundles.
