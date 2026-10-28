const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
process.env.JWT_SECRET = "test-only-secret-do-not-use-in-production";
const { createAccessToken } = require("../src/services/tokenService");
const { createApp } = require("../src/app");

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}


function createMockTasks() {
  let nextId = 1;
  const taskData = [];
  const projects = [];

  function findProject(projectId) {
    return projects.find(
      (project) => project.id === Number(projectId)
    );
  }

  function canAccessProject(projectId, userId) {
    const project = findProject(projectId);
    if (!project) return false;

    const id = Number(userId);

    return (
      project.ownerId === id ||
      project.memberIds.includes(id)
    );
  }

  function canAccess(task, userId) {
    if (!task) return false;

    const id = Number(userId);

    return (
      task.ownerId === id ||
      task.memberIds.includes(id) ||
      (task.projectId !== null &&
        canAccessProject(task.projectId, id))
    );
  }

  function publicTask(task) {
    if (!task) return null;
    const { memberIds, ...result } = task;
    return { ...result };
  }

  return {
    addProject({ id, ownerId, memberIds = [] }) {
      projects.push({
        id: Number(id),
        ownerId: Number(ownerId),
        memberIds: memberIds.map(Number),
      });
    },

    async getById(taskId) {
      return publicTask(
        taskData.find((task) => task.id === Number(taskId))
      );
    },

    async getAllForUser(userId) {
      return taskData
        .filter((task) => canAccess(task, userId))
        .map(publicTask);
    },

    async getByIdForUser(taskId, userId) {
      const task = taskData.find(
        (item) => item.id === Number(taskId)
      );

      return canAccess(task, userId) ? publicTask(task) : null;
    },

    async canAccessProject(projectId, userId) {
      return canAccessProject(projectId, userId);
    },

    async create({
      title,
      description = "",
      dueDate = null,
      ownerId,
      projectId = null,
    }) {
      const task = {
        id: nextId++,
        title: escapeHtml(title),
        description: escapeHtml(description),
        dueDate,
        ownerId: Number(ownerId),
        projectId: projectId === null ? null : Number(projectId),
        status: "todo",
        memberIds: [],
      };

      taskData.push(task);
      return publicTask(task);
    },

    async updateForUser(taskId, userId, changes) {
      const task = taskData.find(
        (item) =>
          item.id === Number(taskId) &&
          canAccess(item, userId)
      );

      if (!task) return null;

      if (changes.title !== undefined) {
        task.title = escapeHtml(changes.title);
      }

      if (changes.description !== undefined) {
        task.description = escapeHtml(changes.description);
      }

      if (changes.dueDate !== undefined) {
        task.dueDate = changes.dueDate;
      }

      if (changes.status !== undefined) {
        task.status = changes.status;
      }

      return publicTask(task);
    },

    async deleteForUser(taskId, userId) {
      const index = taskData.findIndex(
        (item) =>
          item.id === Number(taskId) &&
          canAccess(item, userId)
      );

      if (index === -1) return false;

      taskData.splice(index, 1);
      return true;
    },
  };
}

function tokenFor(id, role = "user") {
  return createAccessToken({
    id,
    email: `user${id}@example.test`,
    role,
  });
}

const mockTasks = createMockTasks();

const app = createApp({
  tasks: mockTasks,
});

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
    listed.body.data.some(
      (task) => task.id === created.body.data.id
    )
  );
});

test("a user cannot see another user's task", async () => {
  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${tokenFor(91002)}`)
    .send({ title: "Private ownership test" });

  assert.equal(created.status, 201);

  const listed = await request(app)
    .get("/api/tasks")
    .set("Authorization", `Bearer ${tokenFor(91003)}`);

  assert.equal(listed.status, 200);
  assert.ok(
    !listed.body.data.some(
      (task) => task.id === created.body.data.id
    )
  );
});

test("deleting another user's task returns 403", async () => {
  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${tokenFor(91004)}`)
    .send({ title: "Do not delete this task" });

  assert.equal(created.status, 201);

  const response = await request(app)
    .delete(`/api/tasks/${created.body.data.id}`)
    .set("Authorization", `Bearer ${tokenFor(91005)}`);

  assert.equal(response.status, 403);
});

test("task title and description HTML are escaped", async () => {
  const response = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${tokenFor(91006)}`)
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

  const updated = await request(app)
    .patch(`/api/tasks/${created.body.data.id}`)
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
  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${tokenFor(91008)}`)
    .send({ title: "Owner task" });

  assert.equal(created.status, 201);

  const response = await request(app)
    .patch(`/api/tasks/${created.body.data.id}`)
    .set("Authorization", `Bearer ${tokenFor(91009)}`)
    .send({ title: "Changed by another user" });

  assert.equal(response.status, 403);
});

test("a user can delete their own task", async () => {
  const token = tokenFor(91010);

  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Task to delete" });

  assert.equal(created.status, 201);

  const taskId = created.body.data.id;

  const deleted = await request(app)
    .delete(`/api/tasks/${taskId}`)
    .set("Authorization", `Bearer ${token}`);

  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.message, "Task deleted successfully");

  const listed = await request(app)
    .get("/api/tasks")
    .set("Authorization", `Bearer ${token}`);

  assert.ok(
    !listed.body.data.some((task) => task.id === taskId)
  );
});

test("deleting a task that does not exist returns 404", async () => {
  const response = await request(app)
    .delete("/api/tasks/999999")
    .set("Authorization", `Bearer ${tokenFor(91011)}`);

  assert.equal(response.status, 404);
});

test("deleting a task with an invalid id returns 400", async () => {
  const response = await request(app)
    .delete("/api/tasks/abc")
    .set("Authorization", `Bearer ${tokenFor(91012)}`);

  assert.equal(response.status, 400);
});

test("a user can update their own task status", async () => {
  const token = tokenFor(91013);

  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Status update task" });

  assert.equal(created.status, 201);
  assert.equal(created.body.data.status, "todo");

  const taskId = created.body.data.id;

  const updated = await request(app)
    .patch(`/api/tasks/${taskId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "in-progress" });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.status, "in-progress");

  const completed = await request(app)
    .patch(`/api/tasks/${taskId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "completed" });

  assert.equal(completed.status, 200);
  assert.equal(completed.body.data.status, "completed");
});

test("invalid task status returns 400", async () => {
  const token = tokenFor(91014);

  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Invalid status test" });

  assert.equal(created.status, 201);

  const response = await request(app)
    .patch(`/api/tasks/${created.body.data.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "finished" });

  assert.equal(response.status, 400);
});

test("another user cannot update task status", async () => {
  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${tokenFor(91015)}`)
    .send({ title: "Private status task" });

  assert.equal(created.status, 201);

  const response = await request(app)
    .patch(`/api/tasks/${created.body.data.id}`)
    .set("Authorization", `Bearer ${tokenFor(91016)}`)
    .send({ status: "completed" });

  assert.equal(response.status, 403);
});


test("a user cannot forge task ownership during creation", async () => {
  const ownerToken = tokenFor(92001);

  const response = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      title: "Ownership protection test",
      ownerId: 92002,
      assigneeId: 92002,
    });

  assert.equal(response.status, 201);
  assert.equal(Number(response.body.data.ownerId), 92001);
  assert.notEqual(Number(response.body.data.ownerId), 92002);
});

test("a project member can create and view a project task", async () => {
  mockTasks.addProject({
    id: 93001,
    ownerId: 93002,
    memberIds: [93003],
  });

  const memberToken = tokenFor(93003);

  const created = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${memberToken}`)
    .send({
      title: "Member project task",
      projectId: 93001,
    });

  assert.equal(created.status, 201);
  assert.equal(Number(created.body.data.ownerId), 93003);
  assert.equal(Number(created.body.data.projectId), 93001);

  const listed = await request(app)
    .get("/api/tasks")
    .set("Authorization", `Bearer ${memberToken}`);

  assert.equal(listed.status, 200);
  assert.ok(
    listed.body.data.some(
      (task) => task.id === created.body.data.id
    )
  );
});

test("a non-member cannot create a task in someone else's project", async () => {
  mockTasks.addProject({
    id: 93002,
    ownerId: 93004,
    memberIds: [93005],
  });

  const response = await request(app)
    .post("/api/tasks")
    .set("Authorization", `Bearer ${tokenFor(93006)}`)
    .send({
      title: "Unauthorized project task",
      projectId: 93002,
    });

  assert.equal(response.status, 403);
});
