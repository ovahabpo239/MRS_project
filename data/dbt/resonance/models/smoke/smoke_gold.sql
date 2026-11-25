-- M1 spike only: proves dbt-spark can read a Delta table from the metastore and write one to
-- gold on S3. Removed once the real FMA models exist.
select n, n * n as n_squared
from {{ source('scratch', 'smoke') }}
