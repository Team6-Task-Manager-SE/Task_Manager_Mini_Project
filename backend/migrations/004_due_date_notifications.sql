
require("dotenv").config();

const pool = require("../config/database");

async function generateDueDateNotifications(database = pool) {
  const result = await database.query(`
    INSERT INTO notifications (
      user_id,
      task_id,
      notification_type,
      message,
      due_at
    )
    SELECT
      COALESCE(t.assignee_id, t.owner_id),
      t.id,
      'due_soon',
      'Task "' || t.title || '" is due within 24 hours.',
      t.due_at
    FROM tasks t
    WHERE t.due_at IS NOT NULL
      AND t.due_at > NOW()
      AND t.due_at <= NOW() + INTERVAL '24 hours'
      AND t.status <> 'completed'
    ON CONFLICT DO NOTHING
    RETURNING id
  `);

  return result.rowCount;
}

module.exports = { generateDueDateNotifications };

if (require.main === module) {
  generateDueDateNotifications()
    .then((count) => {
      console.log(`Created ${count} due-date notification(s).`);
    })
    .catch((error) => {
      console.error("Notification worker failed:", error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
