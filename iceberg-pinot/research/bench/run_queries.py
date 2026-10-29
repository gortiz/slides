#!/usr/bin/env python3
"""Runs the benchmark queries against Pinot tables and prints latency, docs scanned and a result hash.

Times come from the broker (`timeUsedMs`), so client latency (VPN, port-forward) does not count.
The data is static: "now" is fixed after the last day, and every table gets the same parameters.

    run_queries.py --broker https://localhost:18099 --tables plays_bench_et_noidx plays_bench_et_sti \\
        --runs 20 --warmup 3 --out results.jsonl
The bearer token, if any, is read from the PINOT_TOKEN environment variable.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import random
import re
import ssl
import statistics
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
NOW = dt.datetime(2026, 1, 31)  # day after the last generated day (30 days from 2026-01-01)
EPOCH = dt.datetime(1970, 1, 1)


def params(seed, n_users):
    rnd = random.Random(seed)
    micros = lambda d: int((d - EPOCH).total_seconds() * 1_000_000)
    return {"ts_7d": str(micros(NOW - dt.timedelta(days=7))),
            "day_1d": "'" + (NOW - dt.timedelta(days=1)).strftime("%Y-%m-%d") + "'",
            "day_30d": "'" + (NOW - dt.timedelta(days=30)).strftime("%Y-%m-%d") + "'",
            "users": [rnd.randint(1, 20_000) for _ in range(n_users)]}  # power-law: low ids are active


def load_queries():
    text = open(os.path.join(HERE, "queries.sql")).read()
    out = {}
    for block in re.split(r"\n(?=-- Q\d)", text):
        m = re.match(r"-- (Q\d)", block)
        if m:
            out[m.group(1)] = "\n".join(l for l in block.splitlines() if not l.startswith("--")).strip().rstrip(";")
    return out


def post(broker, sql, timeout_ms):
    body = json.dumps({"sql": sql, "queryOptions": f"timeoutMs={timeout_ms}"}).encode()
    req = urllib.request.Request(broker + "/query/sql", body, {"Content-Type": "application/json"})
    if os.environ.get("PINOT_TOKEN"):
        req.add_header("Authorization", "Bearer " + os.environ["PINOT_TOKEN"])
    ctx = ssl._create_unverified_context()  # internal CA
    with urllib.request.urlopen(req, context=ctx, timeout=timeout_ms / 1000 + 30) as r:
        return json.load(r)


def render(q, table, p, user):
    return (q.replace("FROM plays", f"FROM {table}").replace(":user", str(user))
            .replace(":ts_7d", p["ts_7d"]).replace(":day_1d", p["day_1d"]).replace(":day_30d", p["day_30d"]))


def uses_star_tree(broker, sql, timeout_ms):
    r = post(broker, "EXPLAIN PLAN FOR " + sql, timeout_ms)
    return "STARTREE" in json.dumps(r.get("resultTable", {})).upper()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--broker", required=True)
    ap.add_argument("--tables", nargs="+", required=True)
    ap.add_argument("--queries", nargs="*", help="subset, e.g. Q1 Q3")
    ap.add_argument("--runs", type=int, default=20)
    ap.add_argument("--warmup", type=int, default=3)
    ap.add_argument("--timeout-ms", type=int, default=120_000)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out")
    a = ap.parse_args()
    p = params(a.seed, a.runs + a.warmup)
    queries = {k: v for k, v in load_queries().items() if not a.queries or k in a.queries}
    out = open(a.out, "a") if a.out else None
    for table in a.tables:
        for qid, q in queries.items():
            per_user = ":user" in q
            st = uses_star_tree(a.broker, render(q, table, p, p["users"][0]), a.timeout_ms)
            times, docs, hashes, errors = [], [], [], 0
            for i in range(a.warmup + a.runs):
                user = p["users"][i] if per_user else None
                r = post(a.broker, render(q, table, p, user), a.timeout_ms)
                if r.get("exceptions"):
                    errors += 1
                    continue
                if i >= a.warmup:
                    times.append(r["timeUsedMs"])
                    docs.append(r.get("numDocsScanned", 0))
                    rows = r["resultTable"]["rows"]
                    hashes.append(hashlib.sha1(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:10])
            rec = {"table": table, "query": qid, "star_tree": st, "errors": errors, "runs": len(times),
                   "p50_ms": statistics.median(times) if times else None,
                   "p95_ms": sorted(times)[int(0.95 * (len(times) - 1))] if times else None,
                   "docs_scanned_p50": statistics.median(docs) if docs else None,
                   # one hash per parameter set: compare across tables, not across runs
                   "result_hash": hashlib.sha1("".join(hashes).encode()).hexdigest()[:12] if hashes else None,
                   "at": time.strftime("%Y-%m-%dT%H:%M:%S")}
            print(json.dumps(rec), flush=True)
            if out:
                out.write(json.dumps(rec) + "\n")


if __name__ == "__main__":
    main()
