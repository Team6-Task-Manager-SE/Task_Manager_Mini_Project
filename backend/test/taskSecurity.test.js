
const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.JWT_SECRET = "test-only-secret-do-not-use-in-production";

const { createAccessToken } = require("../src/services/tokenService");
const app = require("../src/app");

function tokenFor(id, role = "user") {
  return createAccessToken({
    id,
    email: `user${id}@example.test`,
    role,
  });
}

test("task endpoints reject requests without a bearer token", async () => {
  const response = await request(app).get("/api/tasks");

  assert.equal(response.status, 401);
});

test("task endpoints reject an invalid bearer token", async () => {
  const response = await request(app)
    .get("/api/tasks")
    .set("Authorization", "Bearer invalid-token");

  assert.equal(response.status, 401);
});

test("task endpoints reject a role without task access", async () => {
  const response = await request(app)
    .get("/api/tasks")
    .set("Authorization", `Bearer ${tokenFor(91000, "guest")}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.code, "FORBIDDEN");
});

test("a user can create a task and see their own task", async () => {
  const token = tokenFor(91001);

  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "My private test task" });

  assert.equal(created.status, 201);
  assert.equal(created.body.data.ownerId, 91001);

  const listed = await request(app)
    .get("/api/tasks")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(listed.status, 200);
  assert.ok(
    listed.body.data.some((task) => task.id === created.body.data.id)
  );
});

test("a user cannot see another user's task", async () => {
  const ownerToken = tokenFor(91002);
  const otherUserToken = tokenFor(91003);

  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ title: "Private ownership test" });

  assert.equal(created.status, 201);

  const listed = await request(app)
    .get("/api/tasks")
    .set("Authorization", `Bearer ${otherUserToken}`);

  assert.equal(listed.status, 200);
  assert.ok(
    !listed.body.data.some((task) => task.id === created.body.data.id)
  );
});

test("deleting another user's task returns 403", async () => {
  const ownerToken = tokenFor(91004);
  const otherUserToken = tokenFor(91005);

  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ title: "Do not delete this task" });

  assert.equal(created.status, 201);

  const response = await request(app)
    .delete(`/api/tasks/${created.body.data.id}`)
    .set("Authorization", `Bearer ${otherUserToken}`);

  assert.equal(response.status, 403);
});

test("task title and description HTML are escaped", async () => {
  const token = tokenFor(91006);

  const response = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: '<script>alert("x")</script>',
      description: '<img src=x onerror="alert(1)">',
    });

  assert.equal(response.status, 201);
  assert.ok(!response.body.data.title.includes("<script>"));
  assert.ok(response.body.data.title.includes("&lt;script&gt;"));
  assert.ok(!response.body.data.description.includes("<img"));
  assert.ok(response.body.data.description.includes("&lt;img"));
});

test("a user can edit their own task", async () => {
  const token = tokenFor(91007);

  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Original title",
      description: "Original description",
    });

  assert.equal(created.status, 201);

  const taskId = created.body.data.id;

  const updated = await request(app)
    .patch(`/api/tasks/${taskId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Updated title",
      description: "Updated description",
      dueDate: "2026-10-30",
    });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.title, "Updated title");
  assert.equal(updated.body.data.description, "Updated description");
  assert.equal(updated.body.data.status, "todo");
});

test("editing another user's task returns 403", async () => {
  const ownerToken = tokenFor(91008);
  const otherUserToken = tokenFor(91009);

  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      title: "Owner task",
    });

  assert.equal(created.status, 201);

  const taskId = created.body.data.id;

  const response = await request(app)
    .patch(`/api/tasks/${taskId}`)
    .set("Authorization", `Bearer ${otherUserToken}`)
    .send({
      title: "Changed by another user",
    });

  assert.equal(response.status, 403);
});
