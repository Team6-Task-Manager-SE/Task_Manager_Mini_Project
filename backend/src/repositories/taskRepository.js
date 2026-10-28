
function createTaskRepository(pool) {
  if (!pool || typeof pool.query !== "function") {
    throw new TypeError("A PostgreSQL pool is required");
  }

  // Keep the API response format consistent and escape HTML-sensitive
  // characters in text returned by the API.
  function mapTask(row) {
    if (!row) return null;

    function escapeHtml(value) {
      if (typeof value !== "string") return value;

      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
    }

    return {
      id: row.id,
      projectId: row.project_id,
      ownerId: row.owner_id,
      assigneeId: row.assignee_id,
      title: escapeHtml(row.title),
      description: escapeHtml(row.description),
      status: row.status,
      priority: row.priority,
      dueDate: row.due_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  const taskColumns = `
    id, project_id, owner_id, assignee_id, title,
    description, status, priority, due_at,
    completed_at, created_at, updated_at
  `;

  const userCanAccessTask = `
    (
      t.owner_id = $2
      OR EXISTS (
        SELECT 1
        FROM projects p
        WHERE p.id = t.project_id
          AND p.owner_id = $2
      )
      OR EXISTS (
        SELECT 1
        FROM project_members pm
        WHERE pm.project_id = t.project_id
          AND pm.user_id = $2
      )
    )
  `;

  async function getById(taskId) {
    const result = await pool.query(
      `SELECT ${taskColumns} FROM tasks WHERE id = $1`,
      [taskId]
    );

    return mapTask(result.rows[0]);
  }

  async function getAllForUser(userId) {
    const result = await pool.query(
      `SELECT t.${taskColumns.replaceAll(", ", ", t.").replace(/^/, "")}
       FROM tasks t
       WHERE t.owner_id = $1
          OR EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = t.project_id AND p.owner_id = $1
          )
          OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = t.project_id AND pm.user_id = $1
          )
       ORDER BY t.created_at DESC`,
      [userId]
    );

    return result.rows.map(mapTask);
  }

  async function getByIdForUser(taskId, userId) {
    const result = await pool.query(
      `SELECT t.${taskColumns.replaceAll(", ", ", t.").replace(/^/, "")}
       FROM tasks t
       WHERE t.id = $1
         AND ${userCanAccessTask}`,
      [taskId, userId]
    );

    return mapTask(result.rows[0]);
  }

  async function canAccessProject(projectId, userId) {
    const result = await pool.query(
      `SELECT 1
       FROM projects p
       LEFT JOIN project_members pm
         ON pm.project_id = p.id AND pm.user_id = $2
       WHERE p.id = $1
         AND (p.owner_id = $2 OR pm.user_id = $2)
       LIMIT 1`,
      [projectId, userId]
    );

    return result.rowCount > 0;
  }

  async function create({
    title,
    description = "",
    dueDate = null,
    ownerId,
    projectId = null,
  }) {
    const result = await pool.query(
      `INSERT INTO tasks (title, description, due_at, owner_id, project_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${taskColumns}`,
      [title, description, dueDate, ownerId, projectId]
    );

    return mapTask(result.rows[0]);
  }

  async function updateForUser(taskId, userId, changes) {
    const allowedColumns = {
      title: "title",
      description: "description",
      dueDate: "due_at",
      status: "status",
    };

    const entries = Object.entries(changes).filter(
      ([key, value]) => allowedColumns[key] && value !== undefined
    );

    if (entries.length === 0) {
      return getByIdForUser(taskId, userId);
    }

    const values = entries.map(([, value]) => value);
    const assignments = entries.map(
      ([key], index) => `${allowedColumns[key]} = $${index + 1}`
    );

    values.push(taskId, userId);
    const taskIdParam = values.length - 1;
    const userIdParam = values.length;

    const result = await pool.query(
    `UPDATE tasks t
     SET ${assignments.join(", ")}, updated_at = NOW()
     WHERE t.id = $${taskIdParam}
     AND (
       t.owner_id = $${userIdParam}
       OR EXISTS (
         SELECT 1
         FROM projects p
         WHERE p.id = t.project_id
           AND p.owner_id = $${userIdParam}
       )
       OR EXISTS (
         SELECT 1
         FROM project_members pm
         WHERE pm.project_id = t.project_id
           AND pm.user_id = $${userIdParam}
       )
     )
   RETURNING ${taskColumns}`,
  values);

    return mapTask(result.rows[0]);
  }

  async function deleteForUser(taskId, userId) {
    const result = await pool.query(
      `DELETE FROM tasks t
       WHERE t.id = $1
         AND (
           t.owner_id = $2
           OR EXISTS (
             SELECT 1 FROM projects p
             WHERE p.id = t.project_id AND p.owner_id = $2
           )
           OR EXISTS (
             SELECT 1 FROM project_members pm
             WHERE pm.project_id = t.project_id AND pm.user_id = $2
           )
         )`,
      [taskId, userId]
    );

    return result.rowCount > 0;
  }

  return {
    getById,
    getAllForUser,
    getByIdForUser,
    canAccessProject,
    create,
    updateForUser,
    deleteForUser,
  };
}

module.exports = { createTaskRepository };
