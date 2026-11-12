function createTaskCommentRepository(pool) {
  if (!pool || typeof pool.query !== "function") {
    throw new TypeError("A PostgreSQL pool is required");
  }

  function mapComment(row) {
    if (!row) return null;

    return {
      id: row.id,
      taskId: row.task_id,
      userId: row.user_id,
      content: row.content,
      createdAt: row.created_at,
    };
  }

  async function getAllForUser(taskId, userId) {
    const result = await pool.query(
      `SELECT
         tc.id,
         tc.task_id,
         tc.user_id,
         tc.content,
         tc.created_at
       FROM task_comments tc
       INNER JOIN tasks t ON t.id = tc.task_id
       INNER JOIN projects p ON p.id = t.project_id
       LEFT JOIN project_members pm
         ON pm.project_id = p.id
        AND pm.user_id = $2
       WHERE tc.task_id = $1
         AND (p.owner_id = $2 OR pm.user_id = $2)
       ORDER BY tc.created_at ASC`,
      [taskId, userId]
    );

    return result.rows.map(mapComment);
  }

  async function createForUser(taskId, userId, content) {
    const result = await pool.query(
      `INSERT INTO task_comments (task_id, user_id, content)
       SELECT t.id, $2, $3
       FROM tasks t
       INNER JOIN projects p ON p.id = t.project_id
       LEFT JOIN project_members pm
         ON pm.project_id = p.id
        AND pm.user_id = $2
       WHERE t.id = $1
         AND (p.owner_id = $2 OR pm.user_id = $2)
       RETURNING id, task_id, user_id, content, created_at`,
      [taskId, userId, content.trim()]
    );

    return mapComment(result.rows[0]);
  }

  return {
    getAllForUser,
    createForUser,
  };
}

module.exports = { createTaskCommentRepository };