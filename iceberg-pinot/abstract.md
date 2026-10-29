# Your Iceberg Table Is Already a Pinot Table

Apache Iceberg and Apache Pinot were built a decade apart for different reasons, yet both converged on the same idea: immutable columnar files plus metadata that decides which files a query reads.

This talk explains both from zero: how an Iceberg table is built and pruned, and where min/max statistics stop helping. Then how StarTree's Pinot maps each Parquet file to a segment and builds indexes beside it, so the data stays in your Iceberg table, with no copy.

We will see what changes when an inverted index points to exact rows instead of whole files, and when a star-tree answers aggregations without reading them, with comparisons against Trino and ClickHouse on the same data and hardware. And where it does not help: when no index applies, you still move the bytes. You cannot beat physics.
