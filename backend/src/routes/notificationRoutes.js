
const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");

function createNotificationRouter({ pool }) {
  const router = express.Router();

  router.use(authenticate);
  router.use(authorizeRoles("user", "admin"));

  // Get notifications belonging to the logged-in user.
  router.get("/", async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT id, task_id, notification_type,
                message, is_read, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT 100`,
        [req.user.id]
      );

      res.json({
        status: "success",
        notifications: result.rows,
      });
    } catch (error) {
      next(error);
    }
  });

  // Mark one of the logged-in user's notifications as read.
  router.patch("/:id/read", async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!/^[1-9]\d*$/.test(id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid notification ID",
        });
      }

      const result = await pool.query(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE id = $1
           AND user_id = $2
         RETURNING id, task_id, notification_type,
                   message, is_read, created_at`,
        [id, req.user.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          status: "error",
          message: "Notification not found",
        });
      }

      res.json({
        status: "success",
        notification: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createNotificationRouter;
