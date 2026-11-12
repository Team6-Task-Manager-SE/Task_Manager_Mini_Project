// Tests for TM-F-023 (Projects and Kanban Boards), test case TC-Org-04.
//
// The Kanban board moves a task between columns by sending
// PATCH /api/tasks/:id with the new status, so these tests cover that call,
// plus organising tasks under projects. They use an in-memory fake repository,
// so no database is needed.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.JWT_SECRET = "test-only-secret-do-not-use-in-production";

const { createAccessToken } = require("../src/services/tokenService");
const { createApp } = require("../src/app");

const BOARD_STATUSES = ["todo", "in-progress", "completed"];

function tokenFor(id) {
  return createAccessToken({ id, email: `user${id}@example.test`, role: "user" });
}

const auth = (id) => ({ Authorization: `Bearer ${tokenFor(id)}` });

// Minimal in-memory stand-in for the task repository.
function createFakeTasks({ projectAccess = {} } = {}) {
  const store = new Map();
  const calls = { create: [], update: [] };
  let nextId = 1;

  const copy = (task) => (task ? { ...task } : null);

  return {
    calls,

    async canAccessProject(projectId, userId) {
      return (projectAccess[String(userId)] || []).includes(Number(projectId));
    },

    async isProjectMember() {
      return true;
    },

    async create(input) {
      const task = {
        id: nextId++,
        title: input.title,
        description: input.description,
        status: "todo",
        priority: input.priority || "medium",
        projectId: input.projectId,
        assigneeId: input.assigneeId ?? null,
        ownerId: String(input.ownerId),
        createdAt: new Date().toISOString(),
      };
      calls.create.push(input);
      store.set(task.id, task);
      return copy(task);
    },

    async getById(id) {
      return copy(store.get(id));
    },

    async getByIdForUser(id, userId) {
      const task = store.get(id);
      return task && task.ownerId === String(userId) ? copy(task) : null;
    },

    async updateForUser(id, userId, data) {
      calls.update.push({ id, userId: String(userId), data });
      const task = store.get(id);
      if (!task || task.ownerId !== String(userId)) return null;
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) task[key] = value;
      }
      return copy(task);
    },

    async getAllForUser(userId) {
      return [...store.values()]
        .filter((task) => task.ownerId === String(userId))
        .map(copy);
    },
  };
}

// The app requires a project repository to start, even though these tests only
// exercise the task endpoints.
const unusedProjects = {
  async getAllForUser() {
    return [];
  },
  async createForUser() {
    throw new Error("projects are not used in these tests");
  },
};

function buildApp(options) {
  const tasks = createFakeTasks(options);
  const app = createApp({ tasks, projects: unusedProjects });
  return { app, tasks };
}

async function createTask(app, userId, body) {
  const res = await request(app).post("/api/tasks").set(auth(userId)).send(body);
  assert.equal(res.status, 201, `task creation failed: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

// ------------------------------------------- tasks organised under projects
test("a task can be created under a project the user can access", async () => {
  const { app, tasks } = buildApp({ projectAccess: { 7: [12] } });

  const task = await createTask(app, 7, { title: "Design board", projectId: 12 });

  assert.equal(task.projectId, 12);
  assert.equal(tasks.calls.create[0].projectId, 12);
  assert.equal(tasks.calls.create[0].ownerId, "7");
});

test("a task cannot be created under a project the user cannot access", async () => {
  const { app, tasks } = buildApp({ projectAccess: { 7: [12] } });

  const res = await request(app)
    .post("/api/tasks")
    .set(auth(7))
    .send({ title: "Sneaky", projectId: 99 });

  assert.equal(res.status, 403);
  assert.equal(tasks.calls.create.length, 0);
});

test("a task with an invalid project id is rejected", async () => {
  const { app, tasks } = buildApp({ projectAccess: { 7: [12] } });

  for (const projectId of [0, -3, "abc", 1.5]) {
    const res = await request(app)
      .post("/api/tasks")
      .set(auth(7))
      .send({ title: "Bad project", projectId });
    assert.equal(res.status, 400, `projectId ${projectId} should be rejected`);
  }
  assert.equal(tasks.calls.create.length, 0);
});

test("a task without a project is still allowed", async () => {
  const { app } = buildApp();

  const task = await createTask(app, 7, { title: "No project" });

  assert.equal(task.projectId, null);
});

// -------------------------------------- moving tasks between board columns
test("a new task starts in the To do column", async () => {
  const { app } = buildApp();

  const task = await createTask(app, 7, { title: "Fresh task" });

  assert.equal(task.status, "todo");
});

test("a task can be moved to every board column", async () => {
  const { app } = buildApp();
  const task = await createTask(app, 7, { title: "Move me" });

  for (const status of BOARD_STATUSES) {
    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(auth(7))
      .send({ status });

    assert.equal(res.status, 200, `moving to ${status} failed`);
    assert.equal(res.body.data.status, status);
  }
});

test("a drag-and-drop move only changes the status", async () => {
  const { app, tasks } = buildApp({ projectAccess: { 7: [12] } });
  const task = await createTask(app, 7, {
    title: "Keep my details",
    description: "Should not change",
    projectId: 12,
    priority: "high",
  });

  await request(app)
    .patch(`/api/tasks/${task.id}`)
    .set(auth(7))
    .send({ status: "in-progress" });

  const { data } = tasks.calls.update[0];
  assert.equal(data.status, "in-progress");
  assert.equal(data.title, undefined);
  assert.equal(data.description, undefined);
  assert.equal(data.priority, undefined);

  const [stored] = await tasks.getAllForUser(7);
  assert.equal(stored.title, "Keep my details");
  assert.equal(stored.description, "Should not change");
  assert.equal(stored.projectId, 12);
  assert.equal(stored.priority, "high");
});

test("a column that does not exist is rejected and nothing is saved", async () => {
  const { app, tasks } = buildApp();
  const task = await createTask(app, 7, { title: "Stay put" });

  const res = await request(app)
    .patch(`/api/tasks/${task.id}`)
    .set(auth(7))
    .send({ status: "archived" });

  assert.equal(res.status, 400);
  assert.equal(tasks.calls.update.length, 0);

  const [stored] = await tasks.getAllForUser(7);
  assert.equal(stored.status, "todo");
});

// ----------------------------------------- changes are saved / refresh safe
test("a moved task keeps its new column after the board is refreshed", async () => {
  const { app } = buildApp({ projectAccess: { 7: [12] } });
  const first = await createTask(app, 7, { title: "One", projectId: 12 });
  const second = await createTask(app, 7, { title: "Two", projectId: 12 });
  const third = await createTask(app, 7, { title: "Three", projectId: 12 });

  await request(app).patch(`/api/tasks/${first.id}`).set(auth(7)).send({ status: "in-progress" });
  await request(app).patch(`/api/tasks/${second.id}`).set(auth(7)).send({ status: "completed" });

  // A refresh reloads the list from the API.
  const refreshed = await request(app).get("/api/tasks").set(auth(7));

  assert.equal(refreshed.status, 200);
  const statusOf = (id) => refreshed.body.data.find((task) => task.id === id).status;
  assert.equal(statusOf(first.id), "in-progress");
  assert.equal(statusOf(second.id), "completed");
  assert.equal(statusOf(third.id), "todo");
});

test("every task appears in exactly one column after moves", async () => {
  const { app } = buildApp();
  const created = [];
  for (const title of ["A", "B", "C", "D"]) {
    created.push(await createTask(app, 7, { title }));
  }

  await request(app).patch(`/api/tasks/${created[0].id}`).set(auth(7)).send({ status: "completed" });
  await request(app).patch(`/api/tasks/${created[1].id}`).set(auth(7)).send({ status: "in-progress" });
  await request(app).patch(`/api/tasks/${created[1].id}`).set(auth(7)).send({ status: "completed" });

  const refreshed = await request(app).get("/api/tasks").set(auth(7));
  const columns = Object.fromEntries(BOARD_STATUSES.map((status) => [status, []]));
  for (const task of refreshed.body.data) columns[task.status].push(task.title);

  assert.deepEqual(columns["todo"].sort(), ["C", "D"]);
  assert.deepEqual(columns["in-progress"], []);
  assert.deepEqual(columns["completed"].sort(), ["A", "B"]);
  assert.equal(refreshed.body.data.length, 4);
});

// ------------------------------------------------------- access and safety
test("a user cannot move a task that belongs to someone else", async () => {
  const { app, tasks } = buildApp();
  const task = await createTask(app, 7, { title: "Private task" });

  const res = await request(app)
    .patch(`/api/tasks/${task.id}`)
    .set(auth(8))
    .send({ status: "completed" });

  assert.equal(res.status, 403);
  assert.equal(tasks.calls.update.length, 0);

  const [stored] = await tasks.getAllForUser(7);
  assert.equal(stored.status, "todo");
});

test("moving a task that does not exist returns 404", async () => {
  const { app } = buildApp();

  const res = await request(app)
    .patch("/api/tasks/9999")
    .set(auth(7))
    .send({ status: "completed" });

  assert.equal(res.status, 404);
});

test("moving a task with an invalid id returns 400", async () => {
  const { app } = buildApp();

  for (const id of ["abc", "0", "-4"]) {
    const res = await request(app)
      .patch(`/api/tasks/${id}`)
      .set(auth(7))
      .send({ status: "completed" });
    assert.equal(res.status, 400, `id ${id} should be rejected`);
  }
});

test("board endpoints require authentication", async () => {
  const { app } = buildApp();

  const list = await request(app).get("/api/tasks");
  const move = await request(app).patch("/api/tasks/1").send({ status: "completed" });

  assert.equal(list.status, 401);
  assert.equal(move.status, 401);
});
