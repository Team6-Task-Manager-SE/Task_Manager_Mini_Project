const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.JWT_SECRET = "test-only-secret-for-assignment-notifications";

const { createAccessToken } = require("../src/services/tokenService");
const { createApp } = require("../src/app");

function tokenFor(id) {
  return createAccessToken({ id, email: `user${id}@example.test`, role: "user" });
}

function createHarness({ existingAssignee = null } = {}) {
  const emitted = [];
  const task = {
    id: 4,
    title: "Prepare demo",
    description: "",
    projectId: 3,
    ownerId: 11,
    assigneeId: existingAssignee,
    status: "todo",
    priority: "medium",
    tags: [],
    category: "",
  };
  const tasks = {
    async canAccessProject() { return true; },
    async isProjectMember(_projectId, userId) { return Number(userId) === 22; },
    async create(input) { return { ...task, ...input, id: task.id }; },
    async getById() { return { ...task }; },
    async getByIdForUser() { return { ...task }; },
    async updateForUser(_id, _userId, input) { return { ...task, ...input }; },
  };
  const app = createApp({ tasks });
  app.set("io", {
    to(room) {
      return { emit(event, payload) { emitted.push({ room, event, payload }); } };
    },
  });
  return { app, emitted };
}

test("new task assignment emits a private notification to the assignee room", async () => {
  const { app, emitted } = createHarness();
  const response = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${tokenFor(11)}`)
    .send({ title: "Prepare demo", projectId: 3, assigneeId: 22 });

  assert.equal(response.status, 201);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].room, "user:22");
  assert.equal(emitted[0].event, "task:assigned");
  assert.deepEqual(
    { taskId: emitted[0].payload.taskId, title: emitted[0].payload.title },
    { taskId: 4, title: "Prepare demo" }
  );
});

test("changing an assignee emits to the new assignee, not the previous one", async () => {
  const { app, emitted } = createHarness({ existingAssignee: 21 });
  const response = await request(app)
    .patch("/api/tasks/4")
    .set("Authorization", `Bearer ${tokenFor(11)}`)
    .send({ assigneeId: 22 });

  assert.equal(response.status, 200);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].room, "user:22");
  assert.equal(emitted[0].event, "task:assigned");
});

test("updating unrelated task fields does not send an assignment notification", async () => {
  const { app, emitted } = createHarness({ existingAssignee: 22 });
  const response = await request(app)
    .patch("/api/tasks/4")
    .set("Authorization", `Bearer ${tokenFor(11)}`)
    .send({ title: "Updated title" });

  assert.equal(response.status, 200);
  assert.equal(emitted.length, 0);
});
