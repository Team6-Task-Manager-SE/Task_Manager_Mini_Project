const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.JWT_SECRET = "test-only-secret-do-not-use-in-production";

const { createAccessToken } = require("../src/services/tokenService");
const { createApp } = require("../src/app");

let createdProject = null;
let listedForUser = null;
const project = {
  id: 12,
  name: "Study plan",
  description: "Semester work",
  ownerId: 7,
  taskCount: 0,
};
const projects = {
  async getAllForUser(userId) {
    listedForUser = userId;
    return [project];
  },
  async createForUser(input) {
    createdProject = input;
    return { ...project, ownerId: input.ownerId, name: input.name, description: input.description };
  },
};
const app = createApp({ tasks: {}, projects });

function tokenFor(id) {
  return createAccessToken({ id, email: `user${id}@example.test`, role: "user" });
}

test("project endpoints require authentication", async () => {
  const list = await request(app).get("/api/projects");
  const create = await request(app).post("/api/projects").send({ name: "Study plan" });
  assert.equal(list.status, 401);
  assert.equal(create.status, 401);
});

test("project list is scoped to the authenticated user", async () => {
  const response = await request(app)
    .get("/api/projects")
    .set("Authorization", `Bearer ${tokenFor(7)}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].name, "Study plan");
  assert.equal(listedForUser, "7");
});

test("project creation validates input and uses the authenticated owner", async () => {
  createdProject = null;
  const invalid = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${tokenFor(7)}`)
    .send({ name: "   " });

  assert.equal(invalid.status, 400);
  assert.equal(createdProject, null);

  const response = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${tokenFor(7)}`)
    .send({ name: "Study plan", description: "Semester work" });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.id, 12);
  assert.equal(createdProject.ownerId, "7");
  assert.equal(createdProject.name, "Study plan");
});
