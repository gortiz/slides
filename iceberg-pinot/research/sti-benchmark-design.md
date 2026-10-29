# Benchmark design: star-tree and filter indexes on Iceberg External Tables

Status: **shelved (2026-10-02)**. The talk uses published numbers instead: the StarTree vs Trino/ClickHouse benchmark and Arun's "125k QPS on open tables" article (star-tree on External Tables). The generated data and all scratch tables were deleted; `bench/` keeps the generator, configs and runner. Findings worth keeping: on 0.16 an Iceberg `timestamp` must be declared `LONG` `1:MICROSECONDS:EPOCH`; External Tables need RAW forward plus `dictionary: {}` per indexed column; a star-tree needs a low-cardinality date column such as `day`.

## Summary

Generate the talk's `plays` table as an Iceberg table in S3, then run the same six queries
against four Pinot configurations on the on-prem cluster: a native Pinot copy, an External Table
with no indexes, one with filter indexes, and one that adds a star-tree. Measure single-query
latency, sustained QPS, bytes fetched from S3, and the cost side: index build time and size.

The result answers three slide questions with our own data:

1. What does a star-tree buy on Iceberg? (Q3–Q5, configs C2 vs C3.)
2. How close are External Tables to a local copy? (C3 vs C0.)
3. Where does nothing help? (Q6, the physics slide.)

## Cluster (read-only check, 2026-10-01)

| Item | Value |
|---|---|
| Cluster | `startree-dev-onprem`, cell `cell-olxml7-managed`, release `2.196.47` |
| Servers | 3 × (6 vCPU, 56 GiB requested) on 8 vCPU / 64 GiB `pinot-highmem` nodes, 512 GiB disk each |
| Broker, controller | 1 each, 1.5 vCPU / 6 GiB |
| Deep store | **AWS S3, `us-west-2`**, reached from on-prem hardware over the WAN |

The cluster is shared: claim it in `#on-prem-pinot-claim` before any load (see the
`onprem-cluster` skill).

**The deep-store location matters.** The Iceberg bucket will also be in AWS S3, so every remote
read crosses the WAN: higher latency than the published EC2 benchmark, and paid egress. Two
consequences:

- The numbers are a **worst case for remote reads**, which is honest for the physics slide but not
  comparable with the published 4 × r6gd results. Say so on the slide.
- Size the dataset so a full cold scan does not cost much egress (about USD 0.09/GB).

## Where the data lives

| Item | Value |
|---|---|
| SF-dev table | Glue `us-west-2`, database `plays_bench`, table `plays_sf_dev` (Iceberg, 30 snapshots) |
| Warehouse | `s3://golden-dataset-startree/plays-bench/iceberg/` — 480 Parquet files, 1.60 GiB, 100 M rows |
| Written and read with | the shared `golden-dataset-user` key |

The table lives in `us-west-2`, the region of the on-prem cell's S3 tier. The first copy in `eu-north-1`
was deleted on 2026-10-02.

## Pinot release

The on-prem cell runs `2.196.47` (0.16) after a certification run. That release lacks the fast star-tree
and index build on External Tables (startree-pinot#4197, "build-mode Parquet reader"); without it the MiQ
war room saw 16–24 min per segment. `v2.211.2` (0.17) contains #4197. OSS star-tree PRs missing from
0.16: apache/pinot#19430 (off-heap build reads dims from the sort buffer), #19349, #19367, #19595 (not
needed by these queries).

## Dataset: `plays`

The talk's running example, with three extra low-cardinality dimensions so the star-tree has
something to aggregate. The slides keep showing the first five columns.

| Column | Type | Distribution |
|---|---|---|
| `user_id` | LONG | 1 M users (SF-dev), power-law: median 6 plays per user per 3 days |
| `track_id` | LONG | 500 k tracks, power-law |
| `country` | STRING | ~60 values, skewed |
| `ts` | TIMESTAMP | 365 days, daily cycle |
| `ms_played` | LONG | log-normal, 10 s – 10 min |
| `platform` | STRING | 5 values (ios, android, web, desktop, tv) |
| `plan` | STRING | 3 values (free, premium, family) |
| `genre` | STRING | ~30 values, derived from `track_id` |

**Size.** Two scale factors with the same generator and seed:

| Scale | Rows | Parquet (est.) | Use |
|---|---|---|---|
| `SF-dev` | 100 M over 30 days | ~1.6 GiB (measured: 10 M rows = 0.16 GiB, zstd) | First run, on `pinot-test` |
| `SF-talk` | 4 B over 365 days | ~65 GiB (extrapolated) | The published numbers |

100 GB keeps a full cold scan near USD 9 of egress and lets the native copy fit on the servers'
disks with room to spare.

**Layout** (matches the slides):

- `PARTITIONED BY (day(ts), bucket(16, user_id))`
- Files sorted by `ts` inside each partition, target ~256 MB, row groups ~128 MB.
- Catalog: AWS Glue in `us-west-2` (supported by External Tables, no extra service to run).
  Alternative: a REST catalog (Polaris) if we want to avoid Glue.

**Generator.** `bench/generate_plays.py`: DuckDB produces each day's rows from hashes of (row, seed),
sorted by `ts`; PyIceberg writes them with the partition spec above, one commit per day. DuckDB does not
write the Parquet page index, which is realistic: it shows Pinot builds its own (slide "Parquet
101"). Fixed seed, so anyone can regenerate the exact table. Note: SF-dev files are small (~3.4 MB, 480 files)
because 30 days × 16 buckets split 100 M rows thinly; that also keeps per-segment star-tree builds short.

## Queries

Parameters (user, country, dates) come from a fixed, seeded list so every configuration runs the
same query stream. Each result is hashed to prove the configurations return identical answers.

| Id | Shape | Represents | Should be helped by |
|---|---|---|---|
| Q1 | `SUM(ms_played), COUNT(*)` for one user, last 7 days | "your week in music" | partition bucket + inverted index on `user_id` |
| Q2 | Top 10 tracks for one user, last 7 days | same card, second widget | inverted index |
| Q3 | `SUM(ms_played), COUNT(*), DISTINCTCOUNTHLL(user_id)` by country, platform, last 30 days | product dashboard | **star-tree** |
| Q4 | Daily plays by plan, last 90 days | trend chart | **star-tree** |
| Q5 | Top genres by country, yesterday | editorial dashboard | **star-tree** |
| Q6 | `AVG(ms_played)` by `track_id`, last 30 days | high-cardinality scan | **nothing** — the control |

Q1 and Q2 are the user-facing queries (high QPS); Q3–Q5 are where the star-tree matters; Q6 is
the "you cannot beat physics" control.

## Configurations

| Id | Table | Indexes |
|---|---|---|
| C0 | Native Pinot OFFLINE table, same data | inverted `user_id`, `track_id`; range `ts`; same star-tree as C3 |
| C1 | External Table | none (page index and null vectors only) |
| C2 | External Table | inverted `user_id`, `track_id`; range `ts` |
| C3 | External Table | C2 + star-tree |

Star-tree for C0 and C3: split order `day, country, platform, plan, genre`; aggregations `COUNT(*)`,
`SUM(ms_played)`, `DISTINCTCOUNTHLL(user_id)`; `enableDynamicStarTreeCreation=true` (the MiQ war
room found it silently skipped otherwise).

Each External Table configuration runs in three cache states:

| State | Setup |
|---|---|
| cold | caches cleared, no index pinning |
| pinned | indexes preloaded locally, page cache cleared |
| warm | indexes pinned and page cache warm |

## Measurements

| What | How |
|---|---|
| Latency p50 / p95 / p99 | 1 client, sequential, 10 warm-up + 100 measured runs per query |
| Sustained QPS | Ramp per query until p95 > 500 ms or errors; record the last passing step |
| Bytes fetched from S3, GET count | Parquet reader metrics (PAGE / CHUNK series) and S3 client counters |
| Server CPU, network in | Prometheus / Grafana of the cell |
| Index build time | Per segment and total, from server logs (`Finished building … star-trees`) |
| Index size | Per segment on the S3 tier and on local disk |
| Onboarding time | Snapshot sync to queryable, per configuration |

Run the load generator **inside the cluster** (a pod in the cell namespace), not through
Tailscale, so client latency does not pollute the numbers. Reuse the JMeter plan from the
published benchmark, or `pinot-performance-test`, whichever is quicker to point at a new table.

## Procedure

1. Generate `SF-dev`, create C1–C3 on it, check result hashes match and the star-tree is used
   (explain plan shows `FILTER_STARTREE_INDEX`).
2. Measure star-tree build time on `SF-dev` and extrapolate to `SF-talk`. MiQ saw 16–24 min per
   segment; if the estimate exceeds the claim window, reduce rows per file or the scale factor.
3. Claim the cluster with the full plan and ETA. Generate `SF-talk`, create all configurations,
   run the matrix (6 queries × 4 configs × 3 cache states, where applicable).
4. Repeat the full run once to check variance.
5. Drop the scratch tables, release the claim, archive raw results and the generator script.

## Risks and open questions

- **Release.** `2.196.47` is the 0.16 line. The star-tree fixes for External Tables found in the
  MiQ war room (for example apache/pinot#19595, Sep 19) may need a newer image: changing the image
  must be announced in the claim.
- **Build cost.** Star-tree build on Parquet is CPU-bound (random-order page decoding). It is a
  real cost to report, but it can also blow the time budget; measure on `SF-dev` first.
- **WAN to S3.** Worst-case remote latency; also adds egress cost. Decide whether to state it as a
  feature ("even over the WAN") or a caveat.
- **Competitor baseline.** Adding Trino on the same data would make the slide stronger but doubles
  the work and invites the "unfair benchmark" debate. Proposal: Pinot-only, and cite the published
  Trino/ClickHouse benchmark for the cross-engine comparison.
- **Who runs it**, and whether the results also become a StarTree blog post (then marketing review
  applies before the talk).
