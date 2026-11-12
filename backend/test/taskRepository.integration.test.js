
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

require("dotenv").config();

const pool = require("../src/config/database");
const { createTaskRepository } = require("../src/repositories/taskRepository");

after(async () => {
  await pool.end();
});

test("PostgreSQL repository supports CRUD and project-membership authorization", async () => {
  const repository = createTaskRepository(pool);
  const suffix = randomUUID();

  const userIds = [];
  let projectId = null;
  const taskIds = [];

  async function createUser(label) {
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [
        `Temporary ${label}`,
        `repository-test-${label}-${suffix}@example.test`,
        "test-only-not-a-real-password",
      ]
    );

    const id = result.rows[0].id;
    userIds.push(id);
    return id;
  }

  try {
    const ownerId = await createUser("owner");
    const memberId = await createUser("member");
    const unrelatedUserId = await createUser("unrelated");

    // Create a project owned by the first user.
    const projectResult = await pool.query(
      `INSERT INTO projects (owner_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [ownerId, `Repository test project ${suffix}`, "Temporary test project"]
    );

    projectId = projectResult.rows[0].id;

    // Add the second user as a project member.
    await pool.query(
      `INSERT INTO project_members (project_id, user_id, membership_role)
       VALUES ($1, $2, $3)`,
      [projectId, memberId, "member"]
    );

    // Create a project task owned by the project owner.
    const projectTask = await repository.create({
      title: "Project membership integration test",
      description: "Temporary project task",
      ownerId,
      projectId,
    });

    taskIds.push(projectTask.id);

    assert.ok(projectTask.id);
    assert.equal(Number(projectTask.projectId), Number(projectId));

    // The owner can access the task.
    const ownerView = await repository.getByIdForUser(
      projectTask.id,
      ownerId
    );
    assert.ok(ownerView);

    // The project member can access the task through membership.
    const memberView = await repository.getByIdForUser(
      projectTask.id,
      memberId
    );
    assert.ok(memberView);
    assert.equal(
      Number(memberView.id),
      Number(projectTask.id)
    );

    const memberTasks = await repository.getAllForUser(memberId);
    assert.ok(
      memberTasks.some(
        (task) => Number(task.id) === Number(projectTask.id)
      )
    );

    // An unrelated user cannot view, update, or delete the task.
    const unrelatedView = await repository.getByIdForUser(
      projectTask.id,
      unrelatedUserId
    );
    assert.equal(unrelatedView, null);

    const unauthorizedUpdate = await repository.updateForUser(
      projectTask.id,
      unrelatedUserId,
      { title: "Unauthorized modification" }
    );
    assert.equal(unauthorizedUpdate, null);

    const unauthorizedDelete = await repository.deleteForUser(
      projectTask.id,
      unrelatedUserId
    );
    assert.equal(unauthorizedDelete, false);

    // Verify the unauthorized update did not change the database row.
    const unchanged = await repository.getById(projectTask.id);
    assert.equal(
      unchanged.title,
      "Project membership integration test"
    );

    // The member can update a task accessible through project membership.
    const memberUpdate = await repository.updateForUser(
      projectTask.id,
      memberId,
      { title: "Updated by project member" }
    );
    assert.equal(memberUpdate.title, "Updated by project member");

    // A member can delete a task accessible through project membership.
    const memberDelete = await repository.deleteForUser(
      projectTask.id,
      memberId
    );
    assert.equal(memberDelete, true);

    const deletedProjectTask = await repository.getById(projectTask.id);
    assert.equal(deletedProjectTask, null);

    taskIds.splice(
      taskIds.findIndex(
        (id) => Number(id) === Number(projectTask.id)
      ),
      1
    );

    // Also verify standalone task CRUD.
    const standaloneTask = await repository.create({
      title: "Temporary standalone CRUD test",
      description: "Temporary test description",
      ownerId,
    });

    taskIds.push(standaloneTask.id);

    assert.ok(standaloneTask.id);
    assert.equal(Number(standaloneTask.ownerId), Number(ownerId));

    const found = await repository.getByIdForUser(
      standaloneTask.id,
      ownerId
    );
    assert.ok(found);
    assert.equal(found.title, "Temporary standalone CRUD test");

    const updated = await repository.updateForUser(
      standaloneTask.id,
      ownerId,
      { title: "Updated standalone CRUD test" }
    );
    assert.equal(updated.title, "Updated standalone CRUD test");

    const deleted = await repository.deleteForUser(
      standaloneTask.id,
      ownerId
    );
    assert.equal(deleted, true);

    const missing = await repository.getById(standaloneTask.id);
    assert.equal(missing, null);

    taskIds.splice(
      taskIds.findIndex(
        (id) => Number(id) === Number(standaloneTask.id)
      ),
      1
    );

    console.log(
      "PostgreSQL CRUD and project-membership authorization tests passed."
    );
  } finally {
    // Clean up test data even if an assertion fails.
    if (taskIds.length > 0) {
      await pool.query(
        "DELETE FROM tasks WHERE id = ANY($1::bigint[])",
        [taskIds.map(String)]
      );
    }

    if (projectId !== null) {
      await pool.query(
        "DELETE FROM projects WHERE id = $1",
        [projectId]
      );
    }

    if (userIds.length > 0) {
      await pool.query(
        "DELETE FROM users WHERE id = ANY($1::bigint[])",
        [userIds.map(String)]
      );
    }
  }
});
