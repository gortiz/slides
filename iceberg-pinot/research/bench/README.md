# Benchmark kit: `plays` on Iceberg

Design and rationale: `../sti-benchmark-design.md`.

| File | Purpose |
|---|---|
| `generate_plays.py` | Deterministic generator: writes `plays` as an Iceberg table, `PARTITIONED BY (day(ts), bucket(16, user_id))` |
| `queries.sql` | The six benchmark queries (Q1–Q6) |

```sh
python3 -m venv .venv && .venv/bin/pip install duckdb "pyiceberg[pyarrow,pyiceberg-core,sql-sqlite,glue]"

# local check, no cloud: 10 M rows, 3 days, ~0.16 GiB, a few seconds
.venv/bin/python generate_plays.py --catalog sql --warehouse ./wh --rows 10_000_000 --days 3

# SF-dev on AWS (Glue + S3), ~1.6 GiB
.venv/bin/python generate_plays.py --catalog glue --region us-west-2 \
    --warehouse s3://<bucket>/iceberg --database bench --rows 100_000_000 --days 30
```
