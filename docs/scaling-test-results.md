# 5,000-worker local scaling test

- Generated: 2026-11-06
- Host: Windows 11 x64, Node v22.20.0
- Load generator and PostgreSQL ran on the same laptop as the API.
- Target: p90 <= 2,000 ms and zero failed responses.

| Setup and endpoint | Requests | RPS | p50 | p90 | p95 | p99 | Failed | Target |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| One API process, authenticated `GET /api/tasks` | 19,962 | 1,786.8 | 2,508.9 ms | 3,752.5 ms | 4,218.1 ms | 4,590.8 ms | 0 | FAIL |
| Five local API processes behind a round-robin localhost proxy, authenticated `GET /api/tasks` | 24,489 | 2,242.4 | 1,485 ms | 4,504 ms | 4,861.5 ms | 5,154.9 ms | 0 | FAIL |
| Same five-process setup, `GET /api/health` | 10,526 | 831.9 | 3,235 ms | 9,234.9 ms | 9,334.1 ms | 9,433.6 ms | 1,712 | FAIL |

These are local stress results, not a production-capacity claim. The health
check also degraded, which indicates this single-host test setup hit its own
resource limits while running the load generator, database, and API together.
The local runs do not establish whether a production deployment meets the
5,000-user target. Run the documented test against the deployed replicas from
a separate load-generator host before treating the acceptance target as met.
