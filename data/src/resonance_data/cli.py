"""Command line entry point: `python -m resonance_data <command>`."""

import argparse
import sys
import tempfile
from pathlib import Path

from resonance_data.fma import bronze, download, sample
from resonance_data.lake_s3 import LakeStore
from resonance_data.spark import get_spark, lake_uri

DBT_DIR = Path(__file__).resolve().parents[2] / "dbt"


def smoke() -> int:
    """Writes a Delta table to the lake, reads it back and registers it in the metastore."""
    spark = get_spark("smoke", hive=True)
    path = lake_uri("bronze", "_smoke")
    spark.range(5).withColumnRenamed("id", "n").write.format("delta").mode("overwrite").save(path)
    rows = spark.read.format("delta").load(path).count()
    spark.sql("CREATE DATABASE IF NOT EXISTS scratch")
    spark.sql(f"CREATE TABLE IF NOT EXISTS scratch.smoke USING delta LOCATION '{path}'")
    via_catalog = spark.table("scratch.smoke").count()
    print(f"delta rows at {path}: {rows}; through the metastore: {via_catalog}")
    return 0 if rows == via_catalog == 5 else 1


def fma_download(source: str, sha1: str) -> int:
    """Downloads (or copies) the FMA metadata archive, verifies it and lands it in the lake."""
    expected = None if sha1 == "none" else sha1
    with tempfile.TemporaryDirectory() as tmp:
        archive = Path(tmp) / download.ARCHIVE_NAME
        actual = download.fetch(source, archive, expected)
        batch_id = download.land(archive, actual, LakeStore())
    print(f"batch_id={batch_id}")
    return 0


def fma_bronze(batch_id: str | None) -> int:
    """Loads the landed archive of a batch (default: the latest) into the bronze tables."""
    store = LakeStore()
    batch = batch_id or store.get_text(download.LATEST_KEY)
    with tempfile.TemporaryDirectory() as tmp:
        archive = Path(tmp) / download.ARCHIVE_NAME
        store.download(download.raw_key(batch), archive)
        bronze.run_bronze(get_spark("fma-bronze"), archive, batch)
    return 0


def dbt(args: list[str]) -> int:
    """Runs dbt inside a Spark session configured by `get_spark`, so dbt reuses it."""
    from dbt.cli.main import dbtRunner

    get_spark("dbt", hive=True)
    result = dbtRunner().invoke(
        [*args, "--project-dir", str(DBT_DIR / "resonance"), "--profiles-dir", str(DBT_DIR)]
    )
    return 0 if result.success else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="resonance_data")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("smoke", help="check Spark + Delta + S3 + metastore end to end")

    dbt_parser = sub.add_parser("dbt", help="run a dbt command, e.g. `dbt build`")
    dbt_parser.add_argument("dbt_args", nargs=argparse.REMAINDER)

    fma = sub.add_parser("fma", help="Free Music Archive metadata").add_subparsers(
        dest="step", required=True
    )
    dl = fma.add_parser("download", help="fetch the archive and land it in the lake")
    dl.add_argument("--source", default=download.FMA_METADATA_URL, help="URL or local zip path")
    dl.add_argument(
        "--sha1", default=download.FMA_METADATA_SHA1, help="expected SHA-1, or 'none' to skip"
    )
    br = fma.add_parser("bronze", help="load a landed archive into the bronze tables")
    br.add_argument("--batch", default=None, help="batch id (default: the latest landed)")
    sm = fma.add_parser("sample", help="write a tiny synthetic archive (tests, CI, demos)")
    sm.add_argument("--out", required=True, help="path of the zip to write")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "smoke":
        return smoke()
    if args.command == "dbt":
        return dbt(args.dbt_args)
    if args.step == "download":
        return fma_download(args.source, args.sha1)
    if args.step == "sample":
        sample.write_sample_archive(Path(args.out))
        print(f"wrote {args.out}")
        return 0
    return fma_bronze(args.batch)


if __name__ == "__main__":
    sys.exit(main())
