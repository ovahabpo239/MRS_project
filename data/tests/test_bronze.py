from pathlib import Path

from pyspark.sql import DataFrame, SparkSession

from resonance_data.fma.bronze import bronze_path, run_bronze


def table(spark: SparkSession, name: str) -> DataFrame:
    return spark.read.format("delta").load(bronze_path(name))


def test_bronze_loads_every_table_with_lineage_columns(
    spark: SparkSession, sample_archive: Path, local_lake: Path
) -> None:
    counts = run_bronze(spark, sample_archive, "batch1")

    assert counts == {"tracks": 6, "raw_tracks": 7, "genres": 4, "echonest": 3}
    tracks = table(spark, "tracks")
    assert tracks.count() == 6
    assert {"_batch_id", "_source_file", "_ingested_at", "track_license"} <= set(tracks.columns)
    assert {r["_batch_id"] for r in tracks.collect()} == {"batch1"}
    assert {r["_source_file"] for r in tracks.collect()} == {"fma_metadata/tracks.csv"}


def test_bronze_keeps_values_as_delivered_strings(
    spark: SparkSession, sample_archive: Path, local_lake: Path
) -> None:
    run_bronze(spark, sample_archive, "batch1")

    row = table(spark, "tracks").where("track_id = '3'").collect()[0]
    assert row["track_genres"] == "[21, 12]"
    assert row["track_duration"] == "168"
    assert {f.dataType.simpleString() for f in table(spark, "tracks").schema.fields} == {
        "string",
        "timestamp",
    }
    bio = table(spark, "tracks").where("artist_id = '3'").collect()[0]["artist_bio"]
    assert bio == 'Line one.\nLine two, with a comma and "quotes".'


def test_rerunning_a_batch_does_not_duplicate_rows(
    spark: SparkSession, sample_archive: Path, local_lake: Path
) -> None:
    run_bronze(spark, sample_archive, "batch1")
    run_bronze(spark, sample_archive, "batch1")

    assert table(spark, "tracks").count() == 6
    assert table(spark, "echonest").count() == 3


def test_a_new_batch_is_added_next_to_the_old_one(
    spark: SparkSession, sample_archive: Path, local_lake: Path
) -> None:
    run_bronze(spark, sample_archive, "batch1")
    run_bronze(spark, sample_archive, "batch2")

    tracks = table(spark, "tracks")
    assert tracks.count() == 12
    assert {r["_batch_id"] for r in tracks.select("_batch_id").distinct().collect()} == {
        "batch1",
        "batch2",
    }
