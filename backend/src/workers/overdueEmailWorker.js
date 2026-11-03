
require("dotenv").config();

const pool = require("../config/database");
const createEmailService = require("../services/emailService");

async function processOverdueEmailReminders(
  database = pool,
  emailService = createEmailService()
) {
  const queued = await database.query(`
    INSERT INTO overdue_email_reminders (
      task_id,
      user_id,
      due_at
    )
    SELECT
      t.id,
      u.id,
      t.due_at
    FROM tasks t
    JOIN users u
      ON u.id = COALESCE(t.assignee_id, t.owner_id)
    WHERE t.priority = 'high'
      AND t.status <> 'completed'
      AND t.due_at IS NOT NULL
      AND t.due_at < NOW()
      AND u.email_confirmed = TRUE
    ON CONFLICT DO NOTHING
    RETURNING id
  `);

  const client = await database.connect();

  let processed = 0;
  let sent = 0;
  let simulated = 0;

  try {
    await client.query("BEGIN");

    const result = await client.query(`
      SELECT
        r.id,
        r.task_id,
        r.user_id,
        r.due_at,
        u.name,
        u.email,
        t.title
      FROM overdue_email_reminders r
      JOIN tasks t ON t.id = r.task_id
      JOIN users u ON u.id = r.user_id
      WHERE r.status = 'pending'
        AND t.priority = 'high'
        AND t.status <> 'completed'
        AND t.due_at = r.due_at
        AND t.due_at < NOW()
        AND u.email_confirmed = TRUE
      ORDER BY r.created_at, r.id
      LIMIT 20
      FOR UPDATE OF r SKIP LOCKED
    `);

    for (const reminder of result.rows) {
      const delivery =
        await emailService.sendOverdueTaskReminder({
          email: reminder.email,
          name: reminder.name,
          taskTitle: reminder.title,
          dueDate: reminder.due_at,
        });

      if (
        delivery.delivery !== "smtp" &&
        delivery.delivery !== "development-log"
      ) {
        throw new Error("Unknown email delivery result");
      }

      const status =
        delivery.delivery === "smtp"
          ? "sent"
          : "simulated";

      await client.query(
        `
        UPDATE overdue_email_reminders
        SET status = $1,
            delivery_method = $2,
            processed_at = NOW()
        WHERE id = $3
        `,
        [status, delivery.delivery, reminder.id]
      );

      processed++;

      if (status === "sent") {
        sent++;
      } else {
        simulated++;
      }
    }

    await client.query("COMMIT");

    return {
      queued: queued.rowCount,
      processed,
      sent,
      simulated,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { processOverdueEmailReminders };

if (require.main === module) {
  processOverdueEmailReminders()
    .then((result) => {
      console.log(
        "Overdue email worker completed:",
        result
      );
    })
    .catch((error) => {
      console.error(
        "Overdue email worker failed:",
        error
      );
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
