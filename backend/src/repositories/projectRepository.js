function createProjectRepository(pool) {
  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") {
    throw new TypeError("A PostgreSQL pool is required");
  }

  return {
    async getAllForUser(userId) {
      const result = await pool.query(
        `SELECT p.id, p.name, p.description, p.owner_id, p.created_at,
                p.updated_at, COUNT(DISTINCT t.id)::int AS task_count
           FROM projects p
           LEFT JOIN project_members pm ON pm.project_id = p.id
           LEFT JOIN tasks t ON t.project_id = p.id
          WHERE p.owner_id = $1 OR pm.user_id = $1
          GROUP BY p.id
          ORDER BY p.updated_at DESC, p.id DESC`,
        [userId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        ownerId: row.owner_id,
        taskCount: Number(row.task_count),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    async createForUser({ ownerId, name, description = "" }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query(
          `INSERT INTO projects (owner_id, name, description)
           VALUES ($1, $2, $3)
           RETURNING id, name, description, owner_id, created_at, updated_at`,
          [ownerId, name, description]
        );
        const project = result.rows[0];
        await client.query(
          `INSERT INTO project_members (project_id, user_id, membership_role)
           VALUES ($1, $2, 'owner')
           ON CONFLICT (project_id, user_id) DO UPDATE
             SET membership_role = 'owner'`,
          [project.id, ownerId]
        );
        await client.query("COMMIT");
        return {
          id: project.id,
          name: project.name,
          description: project.description,
          ownerId: project.owner_id,
          taskCount: 0,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

module.exports = { createProjectRepository };
