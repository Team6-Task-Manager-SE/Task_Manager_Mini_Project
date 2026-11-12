# Performance testing

Issue #27 provides a small repeatable HTTP load runner. It keeps up to the
requested number of workers sending requests for the selected duration and
reports throughput, latency percentiles, and failed responses. The pass target
is p90 at or below 2,000 ms with no failed responses.

## Run locally

Start the backend and frontend in separate terminals. The backend needs its
normal PostgreSQL and Redis configuration. Build and preview the frontend so
the measured route uses the production bundle:

```sh
# Terminal 1, from backend/
npm run dev

# Terminal 2, from frontend/
npm run build
npm run preview -- --host 127.0.0.1 --port 4173

# Terminal 3, from backend/
npm run perf -- \
  --url http://127.0.0.1:4173/ \
  --url http://127.0.0.1:5000/api/health \
  --concurrency 500 \
  --duration 20 \
  --output ../docs/performance-test-results.md
```

`--url` can be repeated. For an authenticated API route, set
`PERF_BEARER_TOKEN` in the shell and pass `--token-env PERF_BEARER_TOKEN`; the
runner does not print the token. Options `--concurrency`, `--duration`, and
`--timeout` are bounded to avoid accidental unbounded load.

## What the result means

The frontend URL measures the HTML shell response and the API URL measures the
selected HTTP endpoint. The runner consumes each response body. This is useful
for repeatable server-side comparisons, but it is not a browser rendering
measurement: browser startup, JavaScript execution, styles, images, and client
interactions are not combined into a page-load metric. Run an authenticated
task or analytics endpoint with a configured database for application-data
latency. Results depend on the host, database, network, and build being tested.

The GitHub Actions workflow runs lint, frontend production builds, and
database-independent backend tests on Ubuntu, Windows, and macOS. PostgreSQL
integration tests run on Ubuntu against PostgreSQL 16.
