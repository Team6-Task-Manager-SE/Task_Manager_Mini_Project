
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getMonthRange,
  calculateMonthlyUptime,
} = require("../src/scripts/monthly-uptime-report");

function observation(time, available) {
  return {
    checkedAt: time,
    available,
    statusCode: available ? 200 : null,
  };
}

test("accepts valid month and rejects invalid months", () => {
  const range = getMonthRange("2026-11");

  assert.equal(
    range.start.toISOString(),
    "2026-11-01T00:00:00.000Z"
  );

  assert.equal(
    range.end.toISOString(),
    "2026-12-01T00:00:00.000Z"
  );

  assert.throws(() => getMonthRange("2026-13"));
  assert.throws(() => getMonthRange("November"));
});

test("calculates uptime from monitored observations", () => {
  const records = [
    observation("2026-11-01T00:00:10Z", true),
    observation("2026-11-01T00:01:10Z", true),
    observation("2026-11-01T00:02:10Z", false),
    observation("2026-11-01T00:03:10Z", true),
  ];

  const report = calculateMonthlyUptime(
    records,
    [],
    "2026-11",
    new Date("2026-11-01T00:04:00Z")
  );

  assert.equal(report.upChecks, 3);
  assert.equal(report.downChecks, 1);
  assert.equal(report.uptimePercent, 75);
  assert.equal(report.coveragePercent, 100);
  assert.equal(report.status, "PROVISIONAL");
});

test("excludes scheduled maintenance observations", () => {
  const records = [
    observation("2026-11-01T00:00:10Z", true),
    observation("2026-11-01T00:01:10Z", false),
    observation("2026-11-01T00:02:10Z", true),
  ];

  const maintenance = [
    {
      start: Date.parse("2026-11-01T00:01:00Z"),
      end: Date.parse("2026-11-01T00:02:00Z"),
    },
  ];

  const report = calculateMonthlyUptime(
    records,
    maintenance,
    "2026-11",
    new Date("2026-11-01T00:03:00Z")
  );

  assert.equal(report.excludedChecks, 1);
  assert.equal(report.downChecks, 0);
  assert.equal(report.upChecks, 2);
  assert.equal(report.uptimePercent, 100);
});

test("does not claim target achievement with missing data", () => {
  const records = [
    observation("2026-11-01T00:00:10Z", true),
  ];

  const report = calculateMonthlyUptime(
    records,
    [],
    "2026-11",
    new Date("2026-11-01T01:00:00Z")
  );

  assert.equal(report.upChecks, 1);
  assert.equal(report.missingChecks, 59);
  assert.equal(report.status, "INSUFFICIENT_DATA");

  assert.ok(report.coveragePercent < 99);
});
