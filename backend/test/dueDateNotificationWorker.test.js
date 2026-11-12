
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateDueDateNotifications,
} = require("../src/workers/dueDateNotificationWorker");

test("generates due-date notifications and returns the created count", async () => {
  const database = {
    async query(sql) {
      assert.match(sql, /INSERT INTO notifications/i);
      assert.match(sql, /t\.due_at/i);
      assert.match(sql, /ON CONFLICT DO NOTHING/i);

      return { rowCount: 1 };
    },
  };

  const count = await generateDueDateNotifications(database);

  assert.equal(count, 1);
});

test("returns zero when no new notifications are created", async () => {
  const database = {
    async query() {
      return { rowCount: 0 };
    },
  };

  const count = await generateDueDateNotifications(database);

  assert.equal(count, 0);
});

test("only selects incomplete tasks due within 24 hours", async () => {
  let executedSQL = "";

  const database = {
    async query(sql) {
      executedSQL = sql;
      return { rowCount: 0 };
    },
  };

  await generateDueDateNotifications(database);

  assert.match(executedSQL, /t\.due_at > NOW\(\)/i);
  assert.match(
    executedSQL,
    /t\.due_at <= NOW\(\) \+ INTERVAL '24 hours'/i
  );
  assert.match(
    executedSQL,
    /t\.status <> 'completed'/i
  );
});

test("stores the actual deadline for rescheduled reminders", async () => {
  let executedSQL = "";

  const database = {
    async query(sql) {
      executedSQL = sql;
      return { rowCount: 0 };
    },
  };

  await generateDueDateNotifications(database);

  assert.match(
    executedSQL,
    /message,\s*due_at\s*\)/i
  );

  assert.match(
    executedSQL,
    /'due_soon',[\s\S]*?t\.due_at\s+FROM tasks/i
  );
});

test("propagates database errors", async () => {
  const database = {
    async query() {
      throw new Error("Database unavailable");
    },
  };

  await assert.rejects(
    generateDueDateNotifications(database),
    /Database unavailable/
  );
});
