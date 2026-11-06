# Horizontally scaled deployment

The API is stateless for authentication: clients send JWTs and task data lives
in PostgreSQL. Redis holds shared authentication rate-limit state and carries
Socket.IO room broadcasts between API replicas. A gateway resolves Compose
service names at runtime and forwards API traffic and real-time WebSocket
connections to the API service. The frontend is a static build.

## Prerequisites

- Docker Engine and Docker Compose v2.
- A managed PostgreSQL instance with TLS enabled and the provider CA certificate.
- A private Redis endpoint reachable by every API container. Keep Redis private;
  the Socket.IO adapter uses Redis Pub/Sub to relay events between servers.
- A TLS-terminating load balancer in front of the gateway on port 8080. Set its
  health check to `/api/health` and forward the original host and client address.
- A strong JWT secret, plus database credentials with migration privileges for
  the one-time `migrate` container.

Create `deploy/.env` with `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
`DB_PASSWORD`, `REDIS_URL`, `JWT_SECRET`, `PUBLIC_ORIGIN` (for example
`https://tasks.example.com`), and `DB_SSL_CA_FILE` (absolute path to the CA
certificate). Start from [`deploy/.env.example`](../deploy/.env.example). This
file is not committed. Configure the managed Redis URL with
TLS/authentication when the provider supports it.

## Build and run

From the repository root:

```sh
docker compose --env-file deploy/.env -f deploy/compose.yaml build
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --scale api=3
```

The migration job runs once before API containers start. API replicas skip
startup migrations, use the shared PostgreSQL and Redis services, and connect
to Socket.IO with WebSocket transport so each live connection can be balanced
independently. The Redis adapter carries room events across replicas. To change
capacity without changing application code, adjust `--scale api=N`, keeping the
database connection limit and Redis capacity within their configured limits.

The example exposes port 8080 for a trusted TLS load balancer to reach. Do not
expose the gateway directly to the public internet without TLS and firewall
rules. `TRUST_PROXY=2` is set for the two trusted proxy hops (the external TLS
load balancer and this gateway), so rate limits see the client's original IP.
Adjust it if the deployment has a different trusted proxy chain, and do not
expose the API service directly.

## Validate capacity

Run the performance script against the HTTPS load-balancer URL after the
deployment is healthy:

```sh
cd backend
npm ci
npm run perf -- --url https://tasks.example.com/api/health \
  --concurrency 5000 --duration 60 --timeout 10000 \
  --output ../docs/scaling-test-results.md
```

For authenticated routes, pass `--token-env PERF_BEARER_TOKEN` and provide a
short-lived test token through that environment variable. The report records
latency percentiles, throughput, and failures. Use the same run against an
authenticated task-list endpoint and a browser-based page-load tool before
claiming the 90th-percentile target for application data and page rendering.
Do not treat a health-endpoint run as proof of task database capacity. Results
depend on the deployment size, database limits, Redis capacity, and network.
