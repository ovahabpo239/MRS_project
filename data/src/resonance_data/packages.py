"""Maven coordinates for the jars Spark needs beyond what pyspark ships.

Kept in its own module so the Dockerfile can resolve and cache them in an early layer.
The Delta jars are chosen by `delta.configure_spark_with_delta_pip` to match pyspark.
"""

# Must match the hadoop-client jars inside pyspark (see pyspark/jars/hadoop-client-api-*.jar).
HADOOP_VERSION = "3.5.0"

# hadoop-aws pulls in the AWS SDK v2 bundle as a compile dependency.
EXTRA_PACKAGES = [f"org.apache.hadoop:hadoop-aws:{HADOOP_VERSION}"]
