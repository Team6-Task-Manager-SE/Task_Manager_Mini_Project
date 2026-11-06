
const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");

function createTaskCommentRouter({ tasks, comments }) {
  const router = express.Router();

  router.use(authenticate);
  router.use(authorizeRoles("user", "admin"));

  // Verify that the user belongs to the task's project.
  async function checkAccess(taskId, userId) {
    const task = await tasks.getById(taskId);

    if (!task) {
      return { status: 404, message: "Task not found" };
    }

    if (task.projectId == null) {
      return {
        status: 403,
        message: "Comments are only available for shared project tasks",
      };
    }

    const isMember = await tasks.canAccessProject(
      task.projectId,
      userId
    );

    if (!isMember) {
      return {
        status: 403,
        message: "Project access denied",
      };
    }

    return { status: 200 };
  }

  // Retrieve comments for a task.
  router.get("/:taskId/comments", async (req, res, next) => {
    try {
      const taskId = Number(req.params.taskId);

      if (!Number.isSafeInteger(taskId) || taskId <= 0) {
        return res.status(400).json({
          status: "error",
          message: "Invalid task id",
        });
      }

      const access = await checkAccess(taskId, req.user.id);

      if (access.status !== 200) {
        return res.status(access.status).json({
          status: "error",
          message: access.message,
        });
      }

      const data = await comments.getAllForUser(
        taskId,
        req.user.id
      );

      return res.status(200).json({
        status: "success",
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  // Create a comment and broadcast it to authorized task viewers.
  router.post("/:taskId/comments", async (req, res, next) => {
    try {
      const taskId = Number(req.params.taskId);

      if (!Number.isSafeInteger(taskId) || taskId <= 0) {
        return res.status(400).json({
          status: "error",
          message: "Invalid task id",
        });
      }

      const access = await checkAccess(taskId, req.user.id);

      if (access.status !== 200) {
        return res.status(access.status).json({
          status: "error",
          message: access.message,
        });
      }

      const content = req.body?.content;

      if (
        typeof content !== "string" ||
        !content.trim() ||
        content.trim().length > 5000
      ) {
        return res.status(400).json({
          status: "error",
          message: "Comment must contain 1-5000 characters",
        });
      }

      const data = await comments.createForUser(
        taskId,
        req.user.id,
        content
      );

      if (!data) {
        return res.status(403).json({
          status: "error",
          message: "Project access denied",
        });
      }

      // Broadcast only after the comment is successfully saved.
      const io = req.app.get("io");

      if (io) {
        io.to(`task:${taskId}`).emit("comment:new", data);
      }

      return res.status(201).json({
        status: "success",
        message: "Comment added successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createTaskCommentRouter;
