const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.JWT_SECRET = "test-only-secret-do-not-use-in-production";

const { createAccessToken } = require("../src/services/tokenService");
const app = require("../src/app");
const pool = require("../src/config/database");

async function ensureTestUser(id) {
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [
      id,
      `Feature Test User ${id}`,
      `user${id}@example.test`,
      "test-only-not-a-real-password",
    ]
  );
}

after(async () => {
  await pool.end();
});

const auth = (id) => ({
  Authorization: `Bearer ${createAccessToken({
    id,
    email: `user${id}@example.test`,
    role: "user",
  })}`,
});

const create = async (id, body) => {
  await ensureTestUser(id);

  return request(app)
    .post("/api/tasks")
    .set(auth(id))
    .send(body);
};

// #9 Priority
test("new task defaults to medium priority", async () => {
  const res = await create(92001, { title: "Default priority" });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.priority, "medium");
});

test("task can be created and updated with a priority", async () => {
  const res = await create(92002, { title: "High one", priority: "high" });
  assert.equal(res.body.data.priority, "high");

  const patched = await request(app)
    .patch(`/api/tasks/${res.body.data.id}`)
    .set(auth(92002))
    .send({ priority: "low" });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data.priority, "low");
});

test("invalid priority is rejected", async () => {
  const res = await create(92003, { title: "Bad", priority: "urgent" });
  assert.equal(res.status, 400);
});

// #10 Tags / categories
test("tags are normalized and de-duplicated", async () => {
  const res = await create(92004, {
    title: "Tagged",
    tags: ["Work", " work ", "Urgent"],
    category: "College",
  });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.data.tags, ["work", "urgent"]);
  assert.equal(res.body.data.category, "College");
});

test("tags are HTML-escaped and validated", async () => {
  const res = await create(92005, { title: "XSS", tags: ["<b>x</b>"] });
  assert.equal(res.status, 201);
  assert.ok(!res.body.data.tags[0].includes("<"));

  const bad = await create(92005, { title: "Bad", tags: "notarray" });
  assert.equal(bad.status, 400);
});


// #11 Dashboard summary
// Use fresh IDs on each run so old test data cannot affect summary counts.
const summaryUserBase = 1500000000 + (Date.now() % 100000000);

test("summary counts only the user's own tasks", async () => {
  const userA = summaryUserBase;
  const userB = summaryUserBase + 1;

  const a = await create(userA, {
    title: "A",
    priority: "high",
  });
  await create(userA, { title: "B" });
  await create(userB, { title: "Someone else's" });

  await request(app)
    .patch(`/api/tasks/${a.body.data.id}`)
    .set(auth(userA))
    .send({ status: "completed" });

  const res = await request(app)
    .get("/api/tasks/summary")
    .set(auth(userA));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.total, 2);
  assert.equal(res.body.data.byStatus.completed, 1);
  assert.equal(res.body.data.byPriority.high, 1);
  assert.equal(res.body.data.completionRate, 50);
});

test("summary counts overdue tasks and needs auth", async () => {
  const user = summaryUserBase + 2;

  await create(user, {
    title: "Late",
    dueDate: "2020-01-01",
  });

  const res = await request(app)
    .get("/api/tasks/summary")
    .set(auth(user));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.overdue, 1);

  const noAuth = await request(app).get("/api/tasks/summary");
  assert.equal(noAuth.status, 401);
});
