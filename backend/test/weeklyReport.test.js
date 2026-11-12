
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createWeeklyReportRepository,
} = require("../src/repositories/weeklyReportRepository");

test("calculates weekly productivity metrics", async () => {
  const database = {
    async query(sql, params) {
      assert.match(sql, /FROM tasks/);
      assert.match(sql, /WHERE owner_id = \$1/);
      assert.equal(params[0], 34);

      return {
        rows: [
          {
            created: 5,
            completed: 3,
            created_and_completed: 2,
            overdue: 1,
          },
        ],
      };
    },
  };

  const reports = createWeeklyReportRepository(database);

  const result = await reports.getWeeklyReport(
    34,
    "2026-11-02T00:00:00.000Z",
    "2026-11-09T00:00:00.000Z"
  );

  assert.equal(result.created, 5);
  assert.equal(result.completed, 3);
  assert.equal(result.completionRate, 40);
  assert.equal(result.currentlyOverdue, 1);
});

test("returns zero completion rate when no tasks were created", async () => {
  const database = {
    async query() {
      return {
        rows: [
          {
            created: 0,
            completed: 0,
            created_and_completed: 0,
            overdue: 0,
          },
        ],
      };
    },
  };

  const reports = createWeeklyReportRepository(database);

  const result = await reports.getWeeklyReport(
    34,
    "2026-11-02T00:00:00.000Z",
    "2026-11-09T00:00:00.000Z"
  );

  assert.equal(result.completionRate, 0);
});

test("weekly report uses the authenticated user's ID", async () => {
  let userIdUsed;

  const database = {
    async query(sql, params) {
      userIdUsed = params[0];

      return {
        rows: [
          {
            created: 0,
            completed: 0,
            created_and_completed: 0,
            overdue: 0,
          },
        ],
      };
    },
  };

  const reports = createWeeklyReportRepository(database);

  await reports.getWeeklyReport(
    42,
    "2026-11-02T00:00:00.000Z",
    "2026-11-09T00:00:00.000Z"
  );

  assert.equal(userIdUsed, 42);
});

test("rejects missing database dependency", () => {
  assert.throws(
    () => createWeeklyReportRepository(null),
    /PostgreSQL pool is required/
  );
});
