#!/usr/bin/env python3
"""Generates the talk's `plays` table as an Iceberg table, deterministically.

Layout matches the slides: PARTITIONED BY (day(ts), bucket(16, user_id)), rows sorted by ts inside
each day. `day` ('YYYY-MM-DD') is the low-cardinality date that a star-tree can split on. Every value is a hash of (row number, seed), so the same arguments always produce the
same table, whatever DuckDB's thread count.

Local validation (no cloud):
    generate_plays.py --catalog sql --warehouse ./wh --rows 10_000_000 --days 3

AWS Glue + S3 (needs AWS credentials in the environment):
    generate_plays.py --catalog glue --region us-west-2 --warehouse s3://<bucket>/iceberg \\
        --database bench --rows 100_000_000 --days 30

Needs: duckdb, pyiceberg[pyarrow,pyiceberg-core] (+ [glue] for Glue, [sql-sqlite] for local).
"""
import argparse
import os
import time

import duckdb
from pyiceberg.partitioning import PartitionField, PartitionSpec
from pyiceberg.schema import Schema
from pyiceberg.transforms import BucketTransform, DayTransform
from pyiceberg.types import LongType, NestedField, StringType, TimestampType

COLUMNS = [("user_id", LongType()), ("track_id", LongType()), ("country", StringType()),
           ("ts", TimestampType()), ("ms_played", LongType()), ("platform", StringType()),
           ("plan", StringType()), ("genre", StringType()),
           ("day", StringType())]

# Low-cardinality dimensions. Earlier entries are more frequent (see pick() below).
COUNTRIES = ["US", "BR", "GB", "DE", "MX", "FR", "ES", "IN", "CA", "AU", "IT", "JP", "NL", "SE", "AR", "PL",
             "TR", "ID", "PH", "CO", "CL", "BE", "NO", "DK", "FI", "AT", "CH", "IE", "PT", "NZ"]
PLATFORMS = ["android", "ios", "web", "desktop", "tv"]
PLANS = ["free", "premium", "family"]
GENRES = ["pop", "hip-hop", "rock", "latin", "electronic", "r&b", "indie", "country", "k-pop", "metal",
          "jazz", "classical", "reggaeton", "folk", "soul", "punk", "blues", "funk", "ambient", "house",
          "techno", "trap", "afrobeats", "gospel", "opera", "ska", "disco", "grunge", "lo-fi", "soundtrack"]


def uniform(salt, seed):
    """SQL for a deterministic uniform value in [0, 1) per row, from a hash of (row, salt, seed)."""
    return f"((hash(i, '{salt}', {seed}) % 1000000007)::DOUBLE / 1000000007)"


def pick(values, salt, seed, skew):
    """SQL that picks a value from a list, skewed towards the first entries (skew > 1)."""
    literal = "[" + ", ".join("'" + v.replace("'", "''") + "'" for v in values) + "]"
    return f"{literal}[1 + floor(pow({uniform(salt, seed)}, {skew}) * {len(values)})::INT]"


def day_sql(day_index, rows_per_day, start, args):
    first = day_index * rows_per_day
    return f"""
    SELECT *, strftime(ts, '%Y-%m-%d') AS day FROM (
    SELECT
      floor(pow({uniform('user', args.seed)}, 2.5) * {args.users})::BIGINT        AS user_id,
      floor(pow({uniform('track', args.seed)}, 3.0) * {args.tracks})::BIGINT      AS track_id,
      {pick(COUNTRIES, 'country', args.seed, 2.0)}                                AS country,
      TIMESTAMP '{start}' + INTERVAL ({day_index}) DAY
        + to_seconds(floor({uniform('second', args.seed)} * 86400)::BIGINT)       AS ts,
      floor(10000 * exp({uniform('ms', args.seed)} * ln(60)))::BIGINT             AS ms_played,  -- 10 s .. 10 min
      {pick(PLATFORMS, 'platform', args.seed, 1.6)}                               AS platform,
      {pick(PLANS, 'plan', args.seed, 1.4)}                                       AS plan,
      {pick(GENRES, 'genre', args.seed, 2.0)}                                     AS genre
    FROM range({first}, {first + rows_per_day}) t(i)
    )
    ORDER BY ts
    """


def catalog(args):
    if args.catalog == "sql":
        from pyiceberg.catalog.sql import SqlCatalog
        os.makedirs(args.warehouse, exist_ok=True)
        wh = os.path.abspath(args.warehouse)
        return SqlCatalog("local", uri=f"sqlite:///{wh}/catalog.db", warehouse=f"file://{wh}")
    from pyiceberg.catalog.glue import GlueCatalog
    # Credentials come from the environment (AWS_PROFILE or AWS_ACCESS_KEY_ID/...), never from arguments.
    return GlueCatalog("glue", **{"glue.region": args.region, "s3.region": args.region,
                                  "client.region": args.region, "warehouse": args.warehouse})


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--catalog", choices=["sql", "glue"], required=True)
    p.add_argument("--warehouse", required=True, help="local dir (sql) or s3:// URI (glue)")
    p.add_argument("--region", default="us-west-2")
    p.add_argument("--database", default="bench")
    p.add_argument("--table", default="plays")
    p.add_argument("--rows", type=lambda s: int(s.replace("_", "")), required=True)
    p.add_argument("--days", type=int, required=True)
    p.add_argument("--start", default="2026-01-01")
    p.add_argument("--users", type=int, default=1_000_000)
    p.add_argument("--tracks", type=int, default=500_000)
    p.add_argument("--buckets", type=int, default=16)
    p.add_argument("--row-group-rows", type=int, default=131_072)
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()

    cat = catalog(args)
    if (args.database,) not in cat.list_namespaces():
        cat.create_namespace(args.database)
    schema = Schema(*[NestedField(k + 1, n, t, required=True) for k, (n, t) in enumerate(COLUMNS)])
    spec = PartitionSpec(PartitionField(source_id=4, field_id=1000, transform=DayTransform(), name="ts_day"),
                         PartitionField(source_id=1, field_id=1001, transform=BucketTransform(args.buckets),
                                        name="user_id_bucket"))
    table = cat.create_table(f"{args.database}.{args.table}", schema=schema, partition_spec=spec,
                             properties={"write.parquet.row-group-limit": str(args.row_group_rows),
                                         "write.parquet.compression-codec": "zstd"})
    rows_per_day = args.rows // args.days
    arrow_schema = table.schema().as_arrow()
    started = time.time()
    for day in range(args.days):
        t0 = time.time()
        batch = duckdb.sql(day_sql(day, rows_per_day, args.start, args)).to_arrow_table().cast(arrow_schema)
        table.append(batch)  # one commit (snapshot) per day
        print(f"day {day + 1}/{args.days}: {batch.num_rows:,} rows in {time.time() - t0:.1f}s", flush=True)
    files = table.inspect.files()
    total = sum(files.column("file_size_in_bytes").to_pylist())
    print(f"done in {time.time() - started:.0f}s: {files.num_rows} files, {total / 2**30:.2f} GiB, "
          f"{rows_per_day * args.days:,} rows")


if __name__ == "__main__":
    main()
