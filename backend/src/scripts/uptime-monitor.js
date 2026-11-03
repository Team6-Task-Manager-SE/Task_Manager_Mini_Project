
require("dotenv").config();

const fs = require("node:fs/promises");
const path = require("node:path");

const TARGET_URL =
  process.env.UPTIME_TARGET_URL ||
  "http://127.0.0.1:5000/api/health";

const INTERVAL_MS = 60 * 1000;
const TIMEOUT_MS = 10 * 1000;



const LOG_DIR = path.join(
    __dirname,
    "..",
    "..",
    "monitoring-data"
);

const LOG_FILE = path.join(
  LOG_DIR,
  "uptime-history.jsonl"
);

let running = false;

async function checkAvailability() {
  if (running) return;

  running = true;

  const checkedAt = new Date().toISOString();
  const started = performance.now();

  let available = false;
  let statusCode = null;
  let errorMessage = null;

  try {
    const response = await fetch(TARGET_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    statusCode = response.status;
    available = response.ok;
  } catch (error) {
    errorMessage = error.message;
  }

  const responseTimeMs = Math.round(
    performance.now() - started
  );

  const observation = {
    checkedAt,
    available,
    statusCode,
    responseTimeMs,
    error: errorMessage,
  };

  try {
    await fs.mkdir(LOG_DIR, {
      recursive: true,
    });

    await fs.appendFile(
      LOG_FILE,
      JSON.stringify(observation) + "\n",
      "utf8"
    );

    const label = available ? "UP" : "DOWN";

    console.log(
      `[${checkedAt}] ${label} | ${responseTimeMs} ms`
    );
  } catch (error) {
    console.error(
      "Unable to save availability observation:",
      error
    );
  } finally {
    running = false;
  }
}

console.log("Task Manager Uptime Monitor");
console.log("Target:", TARGET_URL);
console.log("Interval: 60 seconds");
console.log("Log:", LOG_FILE);

void checkAvailability();

const timer = setInterval(() => {
  void checkAvailability();
}, INTERVAL_MS);

process.on("SIGINT", () => {
  clearInterval(timer);
  console.log("Monitor stopped.");
  process.exit(0);
});
