# Performance Test Results

- Generated: 2026-11-06T06:46:32.807Z
- Environment: win32 10.0.26300 (x64), Node v22.20.0
- Load: 500 concurrent workers for 15 seconds per URL
- Target: p90 <= 2000 ms and zero failed responses

| URL | Requests | RPS | p50 | p90 | p95 | p99 | Failed | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| http://127.0.0.1:4173/ | 22031 | 1457.9 | 329.2 ms | 370.2 ms | 382.4 ms | 660.8 ms | 0 | PASS |
| http://127.0.0.1:5000/api/health | 77683 | 5163.4 | 93.9 ms | 106.2 ms | 113.4 ms | 128.3 ms | 0 | PASS |

This is a local HTTP smoke/load measurement. The frontend URL measures the HTML shell response; it does not measure browser rendering or asset download as a single page-load metric. Use an authenticated API URL and set `PERF_BEARER_TOKEN` to exercise protected routes. Results depend on the machine and database used.
