function toNumber(value) {
  return Number(value || 0);
}

function createAdminAnalyticsRepository(pool) {
  if (!pool || typeof pool.query !== "function") {
    throw new TypeError("A PostgreSQL pool is required");
  }

  return {
    async getOverview() {
      const [summaryResult, projectsResult] = await Promise.all([
        pool.query(`
          SELECT
            (SELECT COUNT(*) FROM users)::int AS total_users,
            (SELECT COUNT(*) FROM users
              WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_users_30d,
            (SELECT COUNT(DISTINCT user_id) FROM audit_logs
              WHERE event_type = 'USER_LOGGED_IN'
                AND created_at >= NOW() - INTERVAL '30 days')::int AS active_users_30d,
            (SELECT COUNT(*) FROM projects)::int AS total_projects,
            (SELECT COUNT(*) FROM tasks)::int AS total_tasks,
            (SELECT COUNT(*) FROM tasks WHERE status = 'completed')::int AS completed_tasks,
            (SELECT COUNT(*) FROM audit_logs
              WHERE created_at >= NOW() - INTERVAL '30 days')::int AS recorded_events_30d
        `),
        pool.query(`
          SELECT
            p.id,
            p.name,
            p.created_at,
            members.member_count,
            task_counts.task_count,
            task_counts.completed_count
          FROM projects p
          CROSS JOIN LATERAL (
            SELECT COUNT(*)::int AS member_count
            FROM (
              SELECT p.owner_id AS user_id
              UNION
              SELECT pm.user_id
              FROM project_members pm
              WHERE pm.project_id = p.id
            ) project_users
          ) members
          CROSS JOIN LATERAL (
            SELECT
              COUNT(*)::int AS task_count,
              COUNT(*) FILTER (WHERE t.status = 'completed')::int AS completed_count
            FROM tasks t
            WHERE t.project_id = p.id
          ) task_counts
          ORDER BY p.created_at DESC, p.id DESC
        `),
      ]);

      const row = summaryResult.rows[0] || {};
      const projects = projectsResult.rows.map((project) => {
        const taskCount = toNumber(project.task_count);
        const completedCount = toNumber(project.completed_count);
        return {
          id: project.id,
          name: project.name,
          createdAt: project.created_at,
          memberCount: toNumber(project.member_count),
          taskCount,
          completedCount,
          completionRate: taskCount === 0
            ? 0
            : Math.round((completedCount / taskCount) * 100),
        };
      });

      return {
        generatedAt: new Date().toISOString(),
        periodDays: 30,
        summary: {
          totalUsers: toNumber(row.total_users),
          newUsers: toNumber(row.new_users_30d),
          activeUsers: toNumber(row.active_users_30d),
          totalProjects: toNumber(row.total_projects),
          totalTasks: toNumber(row.total_tasks),
          completedTasks: toNumber(row.completed_tasks),
          recordedEvents: toNumber(row.recorded_events_30d),
        },
        projects,
      };
    },
  };
}

module.exports = { createAdminAnalyticsRepository };
