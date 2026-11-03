
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  processOverdueEmailReminders,
} = require("../src/workers/overdueEmailWorker");

function createMockDatabase(rows = []) {
  const queries = [];

  const client = {
    async query(sql, params = []) {
      queries.push({ sql, params });

      if (/SELECT\s+r\.id/i.test(sql)) {
        return { rows };
      }

      return { rowCount: 1, rows: [] };
    },

    release() {},
  };

  return {
    queries,

    async query(sql) {
      queries.push({ sql, params: [] });
      return { rowCount: 1 };
    },

    async connect() {
      return client;
    },
  };
}

test("queues only high-priority overdue incomplete tasks", async () => {
  const database = createMockDatabase();

  const emailService = {
    async sendOverdueTaskReminder() {
      return { delivery: "development-log" };
    },
  };

  await processOverdueEmailReminders(
    database,
    emailService
  );

  const sql = database.queries[0].sql;

  assert.match(sql, /t\.priority = 'high'/);
  assert.match(sql, /t\.status <> 'completed'/);
  assert.match(sql, /t\.due_at < NOW\(\)/);
  assert.match(sql, /u\.email_confirmed = TRUE/);
  assert.match(sql, /ON CONFLICT DO NOTHING/);
});

test("simulates email delivery in development mode", async () => {
  const database = createMockDatabase([
    {
      id: 1,
      task_id: 104,
      user_id: 34,
      due_at: new Date("2026-11-02T03:00:00Z"),
      name: "Test User",
      email: "test@example.com",
      title: "Overdue Task",
    },
  ]);

  let emailSent = false;

  const emailService = {
    async sendOverdueTaskReminder(details) {
      emailSent = true;
      assert.equal(details.taskTitle, "Overdue Task");

      return { delivery: "development-log" };
    },
  };

  const result = await processOverdueEmailReminders(
    database,
    emailService
  );

  assert.equal(emailSent, true);
  assert.equal(result.processed, 1);
  assert.equal(result.simulated, 1);
  assert.equal(result.sent, 0);
});

test("records successful SMTP submission separately", async () => {
  const database = createMockDatabase([
    {
      id: 2,
      task_id: 105,
      user_id: 34,
      due_at: new Date("2026-11-02T03:00:00Z"),
      name: "Test User",
      email: "test@example.com",
      title: "Important Deadline",
    },
  ]);

  const emailService = {
    async sendOverdueTaskReminder() {
      return { delivery: "smtp" };
    },
  };

  const result = await processOverdueEmailReminders(
    database,
    emailService
  );

  assert.equal(result.sent, 1);
  assert.equal(result.simulated, 0);
});

test("rolls back when email delivery fails", async () => {
  const database = createMockDatabase([
    {
      id: 3,
      task_id: 106,
      user_id: 34,
      due_at: new Date("2026-11-02T03:00:00Z"),
      name: "Test User",
      email: "test@example.com",
      title: "Failed Email Test",
    },
  ]);

  const emailService = {
    async sendOverdueTaskReminder() {
      throw new Error("SMTP unavailable");
    },
  };

  await assert.rejects(
    processOverdueEmailReminders(database, emailService),
    /SMTP unavailable/
  );

  assert.ok(
    database.queries.some(
      (entry) => entry.sql === "ROLLBACK"
    )
  );
});

test("uses row locking to reduce concurrent duplicate processing", async () => {
  const database = createMockDatabase();

  const emailService = {
    async sendOverdueTaskReminder() {
      return { delivery: "development-log" };
    },
  };

  await processOverdueEmailReminders(
    database,
    emailService
  );

  const selectQuery = database.queries.find(
    (entry) => /FOR UPDATE OF r SKIP LOCKED/i.test(entry.sql)
  );

  assert.ok(selectQuery);
});
