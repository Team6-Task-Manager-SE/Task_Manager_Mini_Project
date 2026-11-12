function createTaskAssignmentNotificationService({ pool, getIo }) {
  async function notifyAssigned(task, assigneeId) {
    if (!task || !assigneeId) return;

    try {
      const result = await pool.query(
        `INSERT INTO notifications (
           user_id, task_id, notification_type, message
         )
         VALUES ($1, $2, $3, $4)
         RETURNING id, task_id, notification_type,
                   message, is_read, created_at`,
        [
          assigneeId,
          task.id,
          "task_assigned",
          `You have been assigned task: ${task.title}`,
        ]
      );

      const io = getIo?.();

      if (io) {
        io.to(`user:${assigneeId}`).emit(
          "notification:new",
          result.rows[0]
        );
      }
    } catch (error) {
      console.error("Task assignment notification failed:", error);
    }
  }

  return { notifyAssigned };
}

module.exports = { createTaskAssignmentNotificationService };
