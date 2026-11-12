
const fs = require("node:fs");
const path = require("node:path");

const BACKEND_DIR = path.resolve(__dirname, "../..");

const HISTORY_FILE = path.join(
  BACKEND_DIR,
  "monitoring-data",
  "uptime-history.jsonl"
);

const MAINTENANCE_FILE = path.join(
  BACKEND_DIR,
  "monitoring-maintenance.json"
);

const INTERVAL_MS = 60 * 1000;
const TARGET_UPTIME = 99.5;

function getMonthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Month must use YYYY-MM format");
  }

  const start = new Date(`${month}-01T00:00:00.000Z`);

  if (
    Number.isNaN(start.getTime()) ||
    start.toISOString().slice(0, 7) !== month
  ) {
    throw new Error("Invalid reporting month");
  }

  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  return { start, end };
}

function loadHistory(file = HISTORY_FILE) {
  if (!fs.existsSync(file)) return [];

  return fs.readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((record) =>
      !Number.isNaN(Date.parse(record.checkedAt))
    );
}

function loadMaintenance(file = MAINTENANCE_FILE) {
  if (!fs.existsSync(file)) return [];

  const data = JSON.parse(fs.readFileSync(file, "utf8"));

  return (data.windows || []).map((window) => {
    const start = Date.parse(window.start);
    const end = Date.parse(window.end);

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start
    ) {
      throw new Error("Invalid maintenance window");
    }

    return { start, end };
  });
}

function calculateMonthlyUptime(
  observations,
  maintenance,
  month,
  now = new Date()
) {
  const { start, end } = getMonthRange(month);

  const reportStart = start.getTime();
  const reportEnd = Math.min(end.getTime(), now.getTime());

  if (reportEnd <= reportStart) {
    return {
      month,
      target: TARGET_UPTIME,
      status: "NO_DATA",
      uptimePercent: null,
      coveragePercent: 0,
      upChecks: 0,
      downChecks: 0,
      missingChecks: 0,
      excludedChecks: 0,
    };
  }

  const observedMinutes = new Map();

  for (const observation of observations) {
    const timestamp = Date.parse(observation.checkedAt);

    if (
      !Number.isFinite(timestamp) ||
      timestamp < reportStart ||
      timestamp >= reportEnd
    ) {
      continue;
    }

    const minute = Math.floor(timestamp / INTERVAL_MS);

    observedMinutes.set(
      minute,
      observation.available === true
    );
  }

  let upChecks = 0;
  let downChecks = 0;
  let missingChecks = 0;
  let excludedChecks = 0;

  const firstMinute = Math.floor(
    reportStart / INTERVAL_MS
  );

  const lastMinute = Math.ceil(
    reportEnd / INTERVAL_MS
  );

  for (
    let minute = firstMinute;
    minute < lastMinute;
    minute++
  ) {
    const minuteStart = minute * INTERVAL_MS;
    const minuteEnd = minuteStart + INTERVAL_MS;

    const excluded = maintenance.some((window) =>
      window.start < minuteEnd &&
      window.end > minuteStart
    );

    if (excluded) {
      excludedChecks++;
    } else if (!observedMinutes.has(minute)) {
      missingChecks++;
    } else if (observedMinutes.get(minute)) {
      upChecks++;
    } else {
      downChecks++;
    }
  }

  const monitored = upChecks + downChecks;
  const eligible = monitored + missingChecks;

  const uptimePercent =
    monitored === 0
      ? null
      : Number(
          ((upChecks / monitored) * 100).toFixed(2)
        );

  const coveragePercent =
    eligible === 0
      ? 100
      : Number(
          ((monitored / eligible) * 100).toFixed(2)
        );

  const monthComplete =
    now.getTime() >= end.getTime();

  let status = "INSUFFICIENT_DATA";

  if (
    uptimePercent !== null &&
    coveragePercent >= 99
  ) {
    if (!monthComplete) {
      status = "PROVISIONAL";
    } else {
      status =
        uptimePercent >= TARGET_UPTIME
          ? "TARGET_MET"
          : "TARGET_MISSED";
    }
  }

  return {
    month,
    target: TARGET_UPTIME,
    status,
    uptimePercent,
    coveragePercent,
    upChecks,
    downChecks,
    missingChecks,
    excludedChecks,
    monthComplete,
  };
}

if (require.main === module) {
  try {
    const month =
      process.argv[2] ||
      new Date().toISOString().slice(0, 7);

    const result = calculateMonthlyUptime(
      loadHistory(),
      loadMaintenance(),
      month
    );

    console.log(
      "Monthly Uptime Report:",
      JSON.stringify(result, null, 2)
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  getMonthRange,
  calculateMonthlyUptime,
};
