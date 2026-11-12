const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const validateRequest = require("../src/middleware/validateRequest");
const { createTaskRules } = require("../src/validators/taskValidators");
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.post(
    "/tasks",
    createTaskRules,
    validateRequest,
    (req, res) => {
      res.status(201).json({
        status: "success",
        message: "Task input is valid",
      });
    }
  );
  return app;}
test("rejects a task with a missing title", async () => {
  const response = await request(createTestApp())
    .post("/tasks")
    .send({ description: "Test task" });
  assert.equal(response.status, 400);
  assert.equal(response.body.status, "error");
});
test("rejects a task with a blank title", async () => {
  const response = await request(createTestApp())
    .post("/tasks")
    .send({ title: "   " });
  assert.equal(response.status, 400);
});
test("accepts a task with a valid title", async () => {
  const response = await request(createTestApp())
    .post("/tasks")
    .send({ title: "Finish validation" });
  assert.equal(response.status, 201);
});
test("rejects a title longer than 200 characters", async () => {
  const response = await request(createTestApp())
    .post("/tasks")
    .send({ title: "a".repeat(201) });
  assert.equal(response.status, 400);
});
test("rejects an invalid due date", async () => {
  const response = await request(createTestApp())
    .post("/tasks")
    .send({ title: "Valid title", dueDate: "not-a-date" });
  assert.equal(response.status, 400);
});
