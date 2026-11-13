"""SparkSession factory: Delta Lake on S3 (RustFS locally, AWS S3 in the cloud).

Everything environment-specific comes from env vars, so the same code runs against the local
lake and against real S3:

    S3_ENDPOINT           custom S3 endpoint (local lake); unset for AWS S3
    AWS_REGION            region for the S3 client (default us-east-1)
    AWS_ACCESS_KEY_ID /   credentials for the local lake; on AWS use the default
    AWS_SECRET_ACCESS_KEY credential chain (Pod Identity, instance role) and leave these unset
    LAKE_BUCKET           bucket holding bronze/, silver/ and gold/ (default lake)
    LAKE_ROOT             overrides s3a://<bucket>, e.g. file:///tmp/lake in unit tests
    SPARK_DRIVER_MEMORY   driver heap (default 3g)
    SPARK_METASTORE_DIR   Derby metastore directory, only used with hive=True
    SPARK_IVY_DIR         cache of the resolved Maven jars (baked into the image)
"""

import os

from delta import configure_spark_with_delta_pip
from pyspark.sql import SparkSession

from resonance_data.packages import EXTRA_PACKAGES

LAYERS = ("bronze", "silver", "gold")


def lake_uri(layer: str, *parts: str) -> str:
    """s3a:// URI of a path inside one layer of the lake."""
    if layer not in LAYERS:
        raise ValueError(f"unknown layer {layer!r}, expected one of {LAYERS}")
    root = os.environ.get("LAKE_ROOT") or f"s3a://{os.environ.get('LAKE_BUCKET', 'lake')}"
    return "/".join([root.rstrip("/"), layer, *parts])


def get_spark(app_name: str = "resonance-data", *, hive: bool = False) -> SparkSession:
    """Returns the (single) local session, creating it on first use.

    hive=True keeps table definitions in a persistent Derby metastore, which dbt needs so that
    gold tables survive between runs.
    """
    builder = (
        SparkSession.builder.appName(app_name)
        .master(os.environ.get("SPARK_MASTER", "local[*]"))
        .config("spark.driver.memory", os.environ.get("SPARK_DRIVER_MEMORY", "3g"))
        .config("spark.ui.enabled", "false")
        .config("spark.sql.shuffle.partitions", "8")
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config(
            "spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog"
        )
        .config("spark.jars.ivy", os.environ.get("SPARK_IVY_DIR", "/opt/ivy"))
    )

    endpoint = os.environ.get("S3_ENDPOINT")
    if endpoint:
        builder = (
            builder.config("spark.hadoop.fs.s3a.endpoint", endpoint)
            .config("spark.hadoop.fs.s3a.path.style.access", "true")
            .config("spark.hadoop.fs.s3a.connection.ssl.enabled", str(endpoint.startswith("https")))
        )
    builder = builder.config(
        "spark.hadoop.fs.s3a.endpoint.region", os.environ.get("AWS_REGION", "us-east-1")
    )

    if hive:
        metastore = os.environ.get("SPARK_METASTORE_DIR", "/var/metastore")
        builder = (
            builder.enableHiveSupport()
            .config("spark.sql.warehouse.dir", lake_uri("gold", "warehouse"))
            .config(
                "spark.hadoop.javax.jdo.option.ConnectionURL",
                f"jdbc:derby:;databaseName={metastore}/metastore_db;create=true",
            )
            .config("spark.driver.extraJavaOptions", f"-Dderby.system.home={metastore}")
        )

    return configure_spark_with_delta_pip(builder, extra_packages=EXTRA_PACKAGES).getOrCreate()
