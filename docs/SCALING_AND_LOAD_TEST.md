# Scaling And Load Test

ScholarHAAB is hardened in code for shared-state production traffic, but it is not honest to claim `10k concurrent users` without an actual run.

## What is already hardened

- request rate limiting uses the shared `rate_limit_log` table instead of a single-process in-memory map
- usage credits use the atomic `commit_usage_atomic` RPC
- answers are cached in `answer_cache`
- product access is paid-only, so abusive anonymous traffic is reduced

## Required SQL before heavy traffic

Run:

- [023_distributed_rate_limit_scaling.sql](/Users/User/scholorhaab/docs/sql/023_distributed_rate_limit_scaling.sql)

## Local smoke load test

Build first:

```bash
cd C:\Users\User\scholorhaab
npm run build
```

Run the smoke harness:

```bash
cd C:\Users\User\scholorhaab
npm run perf:smoke
```

Default profile:

- `120` simulated users
- `2` requests per user
- `30` concurrency
- `12` warmup requests before timing
- product: `qbank`

Artifacts:

- [latest_summary.json](/Users/User/scholorhaab/logs/load-test/latest_summary.json)

## Useful overrides

```bash
set LOAD_TEST_USERS=500
set LOAD_TEST_REQUESTS_PER_USER=3
set LOAD_TEST_CONCURRENCY=80
set LOAD_TEST_WARMUP_REQUESTS=20
set LOAD_TEST_PRODUCT=abroad
set LOAD_TEST_P95_TARGET_MS=6000
npm run perf:smoke
```

## 10k-user verification plan

Do not run `10k` from one laptop and call it proof. Use a staging deployment and distributed runners.

Local smoke is only for code-path verification. A local pass does not prove production-scale readiness by itself.

Minimum release proof for the `10k at a time` claim:

1. Run staging on production-sized infrastructure.
2. Seed at least one fully configured payment gateway.
3. Execute distributed traffic with `10,000` unique viewer keys.
4. Record:
   - success rate
   - p50/p95/p99 latency
   - 429 rate
   - 5xx rate
   - Supabase saturation
   - provider timeout rate
5. Block launch if:
   - success rate < `99%`
   - p95 > `6000ms`
   - 5xx > `0.5%`
   - sustained DB/provider saturation is observed

## Honest status

- code path: ready for shared-instance traffic
- operational proof of `10k concurrent`: still requires the staged distributed run above
