function createTaskRepository(pool) {
  if (!pool || typeof pool.query !== "function") {
    throw new TypeError("A PostgreSQL pool is required");
  }

  function escapeHtml(value) {
    if (typeof value !== "string") return value;

    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }

  function normalizeTags(tags = []) {
    if (!Array.isArray(tags)) return [];

    return [
      ...new Set(
        tags
          .filter((tag) => typeof tag === "string")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
  }

  function mapTask(row) {
    if (!row) return null;

    return {
      id: row.id,
      projectId: row.project_id,
      ownerId: row.owner_id,
      assigneeId: row.assignee_id,
      title: escapeHtml(row.title),
      description: escapeHtml(row.description),
      status: row.status,
      priority: row.priority,
      tags: (row.tags || []).map(escapeHtml),
      category: escapeHtml(row.category),
      dueDate: row.due_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  const taskColumns = `
    id, project_id, owner_id, assignee_id, title,
    description, status, priority, tags, category, due_at,
    completed_at, created_at, updated_at
  `;

  const qualifiedTaskColumns = `
    t.id, t.project_id, t.owner_id, t.assignee_id, t.title,
    t.description, t.status, t.priority, t.tags, t.category,
    t.due_at, t.completed_at, t.created_at, t.updated_at
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
      `SELECT ${qualifiedTaskColumns}
       FROM tasks t
       WHERE (
         t.owner_id = $1
         OR EXISTS (
           SELECT 1 FROM projects p
           WHERE p.id = t.project_id AND p.owner_id = $1
         )
         OR EXISTS (
           SELECT 1 FROM project_members pm
           WHERE pm.project_id = t.project_id AND pm.user_id = $1
         )
       )
       ORDER BY t.created_at DESC`,
      [userId]
    );

    return result.rows.map(mapTask);
  }

  async function getByIdForUser(taskId, userId) {
    const result = await pool.query(
      `SELECT ${qualifiedTaskColumns}
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
    priority = "medium",
    tags = [],
    category = null,
  }) {
    const result = await pool.query(
      `INSERT INTO tasks (
         title, description, due_at, owner_id, project_id,
         priority, tags, category
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${taskColumns}`,
      [
        title,
        description,
        dueDate,
        ownerId,
        projectId,
        priority,
        normalizeTags(tags),
        category,
      ]
    );

    return mapTask(result.rows[0]);
  }

  async function updateForUser(taskId, userId, changes) {
    const allowedColumns = {
      title: "title",
      description: "description",
      dueDate: "due_at",
      status: "status",
      priority: "priority",
      tags: "tags",
      category: "category",
    };

    const entries = Object.entries(changes).filter(
      ([key, value]) => allowedColumns[key] && value !== undefined
    );

    if (entries.length === 0) {
      return getByIdForUser(taskId, userId);
    }

    const values = entries.map(([key, value]) =>
      key === "tags" ? normalizeTags(value) : value
    );

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
	AND ${userCanAccessTask.replaceAll("$2", "$" + userIdParam)}
       RETURNING ${taskColumns}`,
      values
    );

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

  async function getSummaryForUser(userId) {
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE t.status = 'todo')::int AS todo,
         COUNT(*) FILTER (WHERE t.status = 'in-progress')::int AS in_progress,
         COUNT(*) FILTER (WHERE t.status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE t.priority = 'low')::int AS low,
         COUNT(*) FILTER (WHERE t.priority = 'medium')::int AS medium,
         COUNT(*) FILTER (WHERE t.priority = 'high')::int AS high,
         COUNT(*) FILTER (
           WHERE t.due_at IS NOT NULL
             AND t.due_at < NOW()
             AND t.status <> 'completed'
         )::int AS overdue
       FROM tasks t
       WHERE (
         t.owner_id = $1
         OR EXISTS (
           SELECT 1 FROM projects p
           WHERE p.id = t.project_id AND p.owner_id = $1
         )
         OR EXISTS (
           SELECT 1 FROM project_members pm
           WHERE pm.project_id = t.project_id AND pm.user_id = $1
         )
       )`,
      [userId]
    );

    const row = result.rows[0];
    const total = Number(row.total);
    const completed = Number(row.completed);

    return {
      total,
      byStatus: {
        todo: Number(row.todo),
        "in-progress": Number(row.in_progress),
        completed,
      },
      byPriority: {
        low: Number(row.low),
        medium: Number(row.medium),
        high: Number(row.high),
      },
      overdue: Number(row.overdue),
      completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }

  return {
    getById,
    getAllForUser,
    getByIdForUser,
    canAccessProject,
    create,
    updateForUser,
    deleteForUser,
    getSummaryForUser,
  };
}

module.exports = { createTaskRepository };
