# How engines read Iceberg: sources

Research for the engine table in chapters 1 and 3. Docs fetched on 2026-10-01. Re-check before
the conference: these features move fast.

Three modes:

1. **Local copy**: load or materialize Iceberg data into the engine's own storage.
2. **Remote scan + cache**: query the Parquet files in place, with or without a local data cache.
3. **Own indexes on remote data**: the engine builds secondary index structures while the data
   stays in the Iceberg Parquet files. Using writer-produced statistics (min/max, Parquet bloom
   filters, page indexes) or partition pruning does **not** count, and neither do materialized
   copies.

A "no" in mode 3 means the official docs do not describe such a feature. No vendor documents the
negative explicitly, except BigQuery for external tables.

## Summary

| Engine | Local copy | Remote scan + cache | Own indexes on remote data |
|---|---|---|---|
| Trino (OSS) | no | yes, file system cache | no |
| Starburst Warp Speed | no | yes | **yes**, indexing + caching layer |
| Amazon Athena | no | partial, result reuse only | no |
| Apache Spark | partial, `CACHE TABLE` | yes, no file cache | no |
| DuckDB | yes | yes, in-memory cache (on-disk via community extension) | no |
| Dremio | yes, Reflections (Iceberg in Dremio's store) | yes, Columnar Cloud Cache | no |
| Snowflake | yes | yes | **yes**, Search Optimization Service (Snowflake-managed confirmed; externally managed implied) |
| BigQuery | partial, CTAS only (no MVs) | yes, result cache only | no for external tables; unclear for managed |
| StarRocks | yes, INSERT + async MVs | yes, Data Cache | no |
| Apache Doris | yes, async MVs | yes, Data Cache | no |
| ClickHouse | yes, INSERT into MergeTree | yes, filesystem cache | no |
| Databricks SQL / Photon | yes, deep clone, MVs | yes, disk cache (Iceberg not named) | no |
| Databricks Lakehouse//RT (Reyden) | reads MVs | yes, managed Iceberg in Unity Catalog only | undisclosed |
| StarTree Pinot | yes, native tables | yes, External Tables | yes, External Tables with indexes |

## Mode 3 evidence (the column that matters)

- **Starburst Warp Speed** (commercial Trino): "transparently adds an indexing and caching layer".
  https://docs.starburst.io/latest/data-engineering/cost-and-performance/set-mode-ws.html
- **Snowflake**: "The search optimization service currently supports… Standard Snowflake tables,
  Interactive tables, Iceberg tables…" and "Search optimization can improve the performance of
  queries on Apache Iceberg™ tables." GA in release 9.14 (May 2025).
  https://docs.snowflake.com/en/user-guide/search-optimization/queries-that-benefit ·
  https://docs.snowflake.com/en/release-notes/2025/9_14.
  Not documented: support on externally managed / catalog-linked tables (absent from their
  unsupported-features list), and where the search access path is stored (billed as Snowflake
  storage, about 1/4 of the table size).
- **BigQuery**: "You can't create a search index on an external table."
  https://docs.cloud.google.com/bigquery/docs/search-intro. Iceberg *managed* tables: neither
  included nor excluded by the search or vector index docs.
- **StarRocks**: bloom filter indexes only "If the Engine type is `olap`".
  https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/CREATE_TABLE/
- **ClickHouse**: "You can only employ Data Skipping Indexes on the MergeTree family of tables."
  https://clickhouse.com/docs/optimize/skipping-indexes
- **Databricks**: Bloom filter indexes were Delta-only and are deprecated: "Do not use Bloom filter
  indexes." https://docs.databricks.com/aws/en/optimizations/bloom-filters. Predictive I/O is a
  read-time optimization, not a stored index. Lakehouse//RT docs credit performance to "predictive
  optimization and liquid clustering" and ask to "verify queries are selective"; no mechanism is
  published. https://docs.databricks.com/aws/en/compute/sql-warehouse/real-time
- **Trino, Athena, Spark, DuckDB, Dremio, Doris**: no secondary indexes over Iceberg in their docs.
  Trino, StarRocks, Doris and ClickHouse *use* writer-produced Parquet bloom filters or page indexes.

## Modes 1 and 2, key sources

- Trino file system cache: https://trino.io/docs/current/object-storage/file-system-cache.html
- Athena query result reuse: https://docs.aws.amazon.com/athena/latest/ug/reusing-query-results.html
- Spark `CACHE TABLE`: https://spark.apache.org/docs/latest/sql-ref-syntax-aux-cache-cache-table.html
- DuckDB Iceberg: https://duckdb.org/docs/current/core_extensions/iceberg/overview.html ·
  1.3 external file cache: https://duckdb.org/2025/05/21/announcing-duckdb-130
- Dremio Reflections and C3: https://docs.dremio.com/current/what-is-dremio/architecture/
- Snowflake Iceberg tables: https://docs.snowflake.com/en/user-guide/tables-iceberg
- BigQuery Iceberg tables ("don't support materialized views"):
  https://docs.cloud.google.com/bigquery/docs/iceberg-tables
- StarRocks Iceberg catalog: https://docs.starrocks.io/docs/data_source/catalog/iceberg.md ·
  Data Cache: https://docs.starrocks.io/docs/data_source/data_cache.md
- Doris MVs: https://doris.apache.org/docs/4.x/query-acceleration/materialized-view/async-materialized-view/overview/ ·
  Data Cache: https://doris.apache.org/docs/4.x/lakehouse/data-cache/
- ClickHouse Iceberg engine: https://clickhouse.com/docs/engines/table-engines/integrations/iceberg
- Databricks Iceberg: https://docs.databricks.com/aws/en/iceberg/ ·
  disk cache: https://docs.databricks.com/aws/en/optimizations/disk-cache ·
  Lakehouse//RT press release: https://www.databricks.com/company/newsroom/press-releases/databricks-launches-lakehousert-bring-real-time-analytics-directly

## Lakehouse//RT facts (for Q&A)

Beta since June 2026, read-only (`SELECT` only), Statement Execution API only, managed Iceberg in
Unity Catalog only (no foreign or external tables). Published: "as low as 10ms", "sub-100
millisecond latency at 12,000 queries per second"; no percentiles, hardware, or method.
