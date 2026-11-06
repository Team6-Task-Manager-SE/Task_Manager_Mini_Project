const fs = require("node:fs/promises");
const os = require("node:os");
const { performance } = require("node:perf_hooks");

function readOption(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? fallback : process.argv[index + 1];
}

function readRepeatedOption(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === `--${name}` && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
      index += 1;
    }
  }
  return values;
}

function positiveInteger(value, name, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${name} must be an integer from 1 to ${max}`);
  }
  return parsed;
}

function percentile(values, percent) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil((percent / 100) * sorted.length) - 1)];
}

async function measure(url, { concurrency, durationSeconds, timeoutMs, token }) {
  const latencies = [];
  let successes = 0;
  let failures = 0;
  const startedAt = performance.now();
  const deadline = startedAt + durationSeconds * 1000;

  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (performance.now() < deadline) {
      const requestStartedAt = performance.now();
      try {
        const response = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
        await response.arrayBuffer();
        latencies.push(performance.now() - requestStartedAt);
        if (response.ok) successes += 1;
        else failures += 1;
      } catch {
        latencies.push(performance.now() - requestStartedAt);
        failures += 1;
      }
    }
  }));

  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  const average = latencies.reduce((sum, item) => sum + item, 0) / Math.max(latencies.length, 1);
  return {
    url,
    requests: latencies.length,
    successes,
    failures,
    requestsPerSecond: Number((latencies.length / elapsedSeconds).toFixed(1)),
    p50Ms: Number(percentile(latencies, 50).toFixed(1)),
    p90Ms: Number(percentile(latencies, 90).toFixed(1)),
    p95Ms: Number(percentile(latencies, 95).toFixed(1)),
    p99Ms: Number(percentile(latencies, 99).toFixed(1)),
    averageMs: Number(average.toFixed(1)),
    passed: failures === 0 && percentile(latencies, 90) <= 2000,
  };
}

async function main() {
  const urls = readRepeatedOption("url");
  if (urls.length === 0) {
    throw new Error("Provide at least one --url (repeat it to measure multiple routes)");
  }

  const concurrency = positiveInteger(readOption("concurrency", "500"), "concurrency", 5000);
  const durationSeconds = positiveInteger(readOption("duration", "20"), "duration", 300);
  const timeoutMs = positiveInteger(readOption("timeout", "10000"), "timeout", 120000);
  const tokenEnv = readOption("token-env", "PERF_BEARER_TOKEN");
  const token = process.env[tokenEnv];
  const results = [];

  for (const value of urls) {
    const url = new URL(value).toString();
    results.push(await measure(url, { concurrency, durationSeconds, timeoutMs, token }));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    platform: `${os.platform()} ${os.release()} (${os.arch()})`,
    node: process.version,
    concurrency,
    durationSeconds,
    slo: "p90 <= 2000 ms and zero failed responses",
    results,
  };

  console.log(JSON.stringify(report, null, 2));
  const outputPath = readOption("output", "");
  if (outputPath) {
    const markdown = [
      "# Performance Test Results",
      "",
      `- Generated: ${report.generatedAt}`,
      `- Environment: ${report.platform}, Node ${report.node}`,
      `- Load: ${concurrency} concurrent workers for ${durationSeconds} seconds per URL`,
      `- Target: ${report.slo}`,
      "",
      "| URL | Requests | RPS | p50 | p90 | p95 | p99 | Failed | Result |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
      ...results.map((result) =>
        `| ${result.url} | ${result.requests} | ${result.requestsPerSecond} | ${result.p50Ms} ms | ${result.p90Ms} ms | ${result.p95Ms} ms | ${result.p99Ms} ms | ${result.failures} | ${result.passed ? "PASS" : "FAIL"} |`
      ),
      "",
      "This is a local HTTP smoke/load measurement. The frontend URL measures the HTML shell response; it does not measure browser rendering or asset download as a single page-load metric. Use an authenticated API URL and set `PERF_BEARER_TOKEN` to exercise protected routes. Results depend on the machine and database used.",
      "",
    ].join("\n");
    await fs.writeFile(outputPath, markdown, "utf8");
  }

  if (results.some((result) => !result.passed)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
