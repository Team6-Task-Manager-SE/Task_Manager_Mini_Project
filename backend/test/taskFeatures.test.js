const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.JWT_SECRET = "test-only-secret-do-not-use-in-production";

const { createAccessToken } = require("../src/services/tokenService");
const app = require("../src/app");

const auth = (id) => ({
  Authorization: `Bearer ${createAccessToken({
    id,
    email: `user${id}@example.test`,
    role: "user",
  })}`,
});

const create = (id, body) =>
  request(app).post("/api/tasks").set(auth(id)).send(body);

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
test("summary counts only the user's own tasks", async () => {
  const a = await create(92006, { title: "A", priority: "high" });
  await create(92006, { title: "B" });
  await create(92007, { title: "Someone else's" });
  await request(app)
    .patch(`/api/tasks/${a.body.data.id}`)
    .set(auth(92006))
    .send({ status: "completed" });

  const res = await request(app).get("/api/tasks/summary").set(auth(92006));
  assert.equal(res.status, 200);
  assert.equal(res.body.data.total, 2);
  assert.equal(res.body.data.byStatus.completed, 1);
  assert.equal(res.body.data.byPriority.high, 1);
  assert.equal(res.body.data.completionRate, 50);
});

test("summary counts overdue tasks and needs auth", async () => {
  await create(92008, { title: "Late", dueDate: "2020-01-01" });
  const res = await request(app).get("/api/tasks/summary").set(auth(92008));
  assert.equal(res.body.data.overdue, 1);

  const noAuth = await request(app).get("/api/tasks/summary");
  assert.equal(noAuth.status, 401);
});
