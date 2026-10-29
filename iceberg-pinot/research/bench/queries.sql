-- Benchmark queries over `plays`. The data is static, so the runner fixes "now" inside the data range and
-- computes the literals: :ts_7d is epoch MICROseconds (Iceberg timestamps), :day_1d / :day_30d are
-- 'YYYY-MM-DD' strings for the `day` column. Draw :user from a fixed, seeded list of users with at least
-- one play; skip user 0 (a hot key).
-- Dashboards filter on `day`, the low-cardinality date a star-tree can split on; the per-user card filters on `ts`.

-- Q1 · "your week in music" — selective, user-facing, high QPS
SELECT SUM(ms_played) AS ms, COUNT(*) AS plays
FROM plays
WHERE user_id = :user AND ts >= :ts_7d;

-- Q2 · top tracks for one user, last 7 days
SELECT track_id, COUNT(*) AS plays
FROM plays
WHERE user_id = :user AND ts >= :ts_7d
GROUP BY track_id ORDER BY plays DESC LIMIT 10;

-- Q3 · product dashboard — star-tree
SELECT country, platform, SUM(ms_played) AS ms, COUNT(*) AS plays, DISTINCTCOUNTHLL(user_id) AS users
FROM plays
WHERE day >= :day_30d
GROUP BY country, platform;

-- Q4 · daily trend by plan, whole table — star-tree
SELECT day, plan, COUNT(*) AS plays
FROM plays
GROUP BY day, plan ORDER BY day, plan LIMIT 1000;

-- Q5 · top genres by country, last day — star-tree
SELECT country, genre, COUNT(*) AS plays
FROM plays
WHERE day = :day_1d
GROUP BY country, genre ORDER BY plays DESC LIMIT 50;

-- Q6 · control: high-cardinality group-by that no index helps
SELECT track_id, AVG(ms_played) AS avg_ms
FROM plays
WHERE day >= :day_30d
GROUP BY track_id ORDER BY avg_ms DESC LIMIT 100;
