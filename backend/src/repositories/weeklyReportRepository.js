
function createWeeklyReportRepository(pool) {
    if (!pool || typeof pool.query !== "function") {
      throw new TypeError("A PostgreSQL pool is required");
    }

    async function getWeeklyReport(userId, weekStart, weekEnd) {
      const result = await pool.query(
        `
        SELECT
          COUNT(*) FILTER (
            WHERE created_at >= $2::timestamptz
              AND created_at < $3::timestamptz
          )::int AS created,

          COUNT(*) FILTER (
            WHERE completed_at >= $2::timestamptz
              AND completed_at < $3::timestamptz
          )::int AS completed,

          COUNT(*) FILTER (
            WHERE created_at >= $2::timestamptz
              AND created_at < $3::timestamptz
              AND completed_at IS NOT NULL
              AND completed_at < $3::timestamptz
          )::int AS created_and_completed,

          COUNT(*) FILTER (
            WHERE due_at IS NOT NULL
              AND due_at < NOW()
              AND status <> 'completed'
          )::int AS overdue

        FROM tasks
        WHERE owner_id = $1
        `,
        [userId, weekStart, weekEnd]
      );

      const row = result.rows[0];

      const created = Number(row.created);
      const completed = Number(row.completed);
      const createdAndCompleted = Number(row.created_and_completed);

      const completionRate =
        created === 0
          ? 0
          : Math.round((createdAndCompleted / created) * 100);

      return {
        weekStart,
        weekEnd,
        created,
        completed,
        completionRate,
        currentlyOverdue: Number(row.overdue),
      };
    }

    return { getWeeklyReport };
  }

  module.exports = { createWeeklyReportRepository };
