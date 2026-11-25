"""Bronze layer: the FMA metadata as delivered, as Delta tables, tagged with where it came from.

Every column is a string. Each table carries `_batch_id` (the archive's SHA-1 prefix),
`_source_file` and `_ingested_at`. Re-running a batch replaces only that batch's rows
(`replaceWhere`), so bronze is idempotent and keeps the history of earlier batches.
"""

import io
import tempfile
import zipfile
from pathlib import Path

from pyspark.sql import SparkSession
from pyspark.sql import functions as F

from resonance_data.fma.csvflat import CsvSpec, flatten_csv
from resonance_data.spark import lake_uri

SPECS = (
    CsvSpec(
        "tracks",
        ("track_id", "album_id", "artist_id", "track_title", "track_license", "set_subset"),
        header_rows=3,
        name_rows=(0, 1),
    ),
    CsvSpec("raw_tracks", ("track_id", "license_title", "license_url", "track_url")),
    CsvSpec("genres", ("genre_id", "n_tracks", "parent", "title", "top_level")),
    CsvSpec(
        "echonest",
        ("track_id", "audio_features_energy", "audio_features_tempo"),
        header_rows=4,
        name_rows=(1, 2),
    ),
)


def bronze_path(table: str) -> str:
    return lake_uri("bronze", "fma", table)


def ingest_table(
    spark: SparkSession, archive: zipfile.ZipFile, spec: CsvSpec, batch_id: str, workdir: Path
) -> int:
    """Flattens one CSV from the archive and writes it to its bronze table; returns the rows."""
    member = f"fma_metadata/{spec.member}"
    flat = workdir / spec.member
    with archive.open(member) as raw, flat.open("w", encoding="utf-8", newline="") as out:
        rows = flatten_csv(io.TextIOWrapper(raw, encoding="utf-8", newline=""), out, spec)

    # Every column stays a string: Spark's CSV reader does not infer types by default.
    frame = (
        spark.read.option("header", True)
        .option("multiLine", True)
        .option("escape", '"')
        .csv(f"file://{flat}")
        .withColumn("_batch_id", F.lit(batch_id))
        .withColumn("_source_file", F.lit(member))
        .withColumn("_ingested_at", F.current_timestamp())
    )
    (
        frame.write.format("delta")
        .mode("overwrite")
        .option("replaceWhere", f"_batch_id = '{batch_id}'")
        .option("mergeSchema", True)
        .save(bronze_path(spec.table))
    )
    flat.unlink()

    written = spark.read.format("delta").load(bronze_path(spec.table))
    stored = written.where(F.col("_batch_id") == batch_id).count()
    if stored != rows:
        raise RuntimeError(f"{spec.table}: wrote {stored} rows for batch {batch_id}, read {rows}")
    return rows


def run_bronze(spark: SparkSession, archive_path: Path, batch_id: str) -> dict[str, int]:
    """Loads every FMA table of one archive into bronze; returns rows per table."""
    counts: dict[str, int] = {}
    with tempfile.TemporaryDirectory() as tmp, zipfile.ZipFile(archive_path) as archive:
        for spec in SPECS:
            counts[spec.table] = ingest_table(spark, archive, spec, batch_id, Path(tmp))
            print(f"bronze fma.{spec.table}: {counts[spec.table]} rows (batch {batch_id})")
    return counts
