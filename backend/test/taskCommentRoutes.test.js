
const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.JWT_SECRET = "test-only-secret-do-not-use-in-production";

const { createAccessToken } = require("../src/services/tokenService");
const { createApp } = require("../src/app");

function tokenFor(id, role = "user") {
  return createAccessToken({
    id,
    email: `user${id}@example.test`,
    role,
  });
}

function createTestContext() {
  const tasks = {
    async getById(taskId) {
      const id = Number(taskId);

      if (id === 1) {
        return { id: 1, projectId: 100, ownerId: 1000 };
      }

      if (id === 2) {
        return { id: 2, projectId: null, ownerId: 1001 };
      }

      return null;
    },

    async canAccessProject(projectId, userId) {
      return (
        Number(projectId) === 100 &&
        [1000, 1001].includes(Number(userId))
      );
    },
  };

  const storedComments = [];
  let nextId = 1;

  const comments = {
    async getAllForUser(taskId, userId) {
      return storedComments
        .filter(
          (comment) =>
            comment.taskId === Number(taskId)
        )
        .map((comment) => ({ ...comment }));
    },

    async createForUser(taskId, userId, content) {
      const comment = {
        id: nextId++,
        taskId: Number(taskId),
        userId: Number(userId),
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };

      storedComments.push(comment);
      return { ...comment };
    },
  };

  return {
    app: createApp({ tasks, comments }),
    storedComments,
  };
}

test("comment endpoints require authentication", async () => {
  const { app } = createTestContext();

  const response = await request(app)
    .get("/api/tasks/1/comments");

  assert.equal(response.status, 401);
});

test("project member can create and retrieve a task comment", async () => {
  const { app } = createTestContext();
  const token = tokenFor(1001);

  const created = await request(app)
    .post("/api/tasks/1/comments")
    .set("Authorization", `Bearer ${token}`)
    .send({ content: "This is my first comment" });

  assert.equal(created.status, 201);
  assert.equal(created.body.data.taskId, 1);
  assert.equal(created.body.data.userId, 1001);
  assert.equal(created.body.data.content, "This is my first comment");

  const retrieved = await request(app)
    .get("/api/tasks/1/comments")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(retrieved.status, 200);
  assert.equal(retrieved.body.data.length, 1);
  assert.equal(
    retrieved.body.data[0].content,
    "This is my first comment"
  );
});

test("comments remain available after a new request", async () => {
  const { app } = createTestContext();
  const memberToken = tokenFor(1001);
  const ownerToken = tokenFor(1000);

  await request(app)
    .post("/api/tasks/1/comments")
    .set("Authorization", `Bearer ${memberToken}`)
    .send({ content: "Persistent comment" });

  const response = await request(app)
    .get("/api/tasks/1/comments")
    .set("Authorization", `Bearer ${ownerToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].content, "Persistent comment");
});

test("non-project member cannot read or create comments", async () => {
  const { app } = createTestContext();
  const token = tokenFor(1002);

  const readResponse = await request(app)
    .get("/api/tasks/1/comments")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(readResponse.status, 403);

  const createResponse = await request(app)
    .post("/api/tasks/1/comments")
    .set("Authorization", `Bearer ${token}`)
    .send({ content: "Unauthorized comment" });

  assert.equal(createResponse.status, 403);
});

test("private task does not support comments", async () => {
  const { app } = createTestContext();
  const token = tokenFor(1001);

  const response = await request(app)
    .post("/api/tasks/2/comments")
    .set("Authorization", `Bearer ${token}`)
    .send({ content: "Private task comment" });

  assert.equal(response.status, 403);
});

test("blank comments are rejected", async () => {
  const { app } = createTestContext();
  const token = tokenFor(1001);

  const response = await request(app)
    .post("/api/tasks/1/comments")
    .set("Authorization", `Bearer ${token}`)
    .send({ content: "   " });

  assert.equal(response.status, 400);
});

test("comments longer than 5000 characters are rejected", async () => {
  const { app } = createTestContext();
  const token = tokenFor(1001);

  const response = await request(app)
    .post("/api/tasks/1/comments")
    .set("Authorization", `Bearer ${token}`)
    .send({ content: "a".repeat(5001) });

  assert.equal(response.status, 400);
});
