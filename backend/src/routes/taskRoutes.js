
const express = require("express");
const {
  createTaskRules,
  updateTaskRules,
} = require("../validators/taskValidators");
const validateRequest = require("../middleware/validateRequest");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");

function createTaskRouter({ tasks }) {
  const router = express.Router();

  function requireUser(req, res, next) {
    if (!req.user || req.user.id == null) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
    }
    next();
  }

  // All task routes require authentication and an allowed role.
  router.use(authenticate);
  router.use(requireUser);
  router.use(authorizeRoles("user", "admin"));

  router.get("/", async (req, res, next) => {
    try {
      const data = await tasks.getAllForUser(req.user.id);
      return res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/",
    createTaskRules,
    validateRequest,
    async (req, res, next) => {
      try {
        const projectId = req.body.projectId ?? null;

        if (projectId !== null) {
          if (
            !Number.isSafeInteger(Number(projectId)) ||
            Number(projectId) <= 0
          ) {
            return res.status(400).json({
              status: "error",
              message: "Invalid project id",
            });
          }

          const allowed = await tasks.canAccessProject(
            Number(projectId),
            req.user.id
          );

          if (!allowed) {
            return res.status(403).json({
              status: "error",
              message: "You are not allowed to access this project",
            });
          }
        }

        const data = await tasks.create({
          title: req.body.title,
          description: req.body.description || "",
          dueDate: req.body.dueDate || null,
          ownerId: req.user.id,
          projectId: projectId === null ? null : Number(projectId),
        });

        return res.status(201).json({
          status: "success",
          message: "Task created successfully",
          data,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Distinguish a missing task (404) from an existing task
  // that belongs to another user (403).
  async function checkTaskAccess(taskId, userId) {
    const task = await tasks.getById(taskId);

    if (!task) {
      return { status: 404, message: "Task not found" };
    }

    const accessible = await tasks.getByIdForUser(taskId, userId);

    if (!accessible) {
      return {
        status: 403,
        message: "You are not allowed to access this task",
      };
    }

    return { status: 200, task: accessible };
  }

  router.patch(
    "/:id",
    updateTaskRules,
    validateRequest,
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
          return res.status(400).json({
            status: "error",
            message: "Invalid task id",
          });
        }

        const access = await checkTaskAccess(id, req.user.id);

        if (access.status !== 200) {
          return res.status(access.status).json({
            status: "error",
            message: access.message,
          });
        }

        const updated = await tasks.updateForUser(id, req.user.id, {
          title: req.body.title,
          description: req.body.description,
          dueDate: req.body.dueDate,
          status: req.body.status,
        });

        if (!updated) {
          return res.status(404).json({
            status: "error",
            message: "Task not found",
          });
        }

        return res.status(200).json({
          status: "success",
          message: "Task updated successfully",
          data: updated,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete("/:id", async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          status: "error",
          message: "Invalid task id",
        });
      }

      const access = await checkTaskAccess(id, req.user.id);

      if (access.status !== 200) {
        return res.status(access.status).json({
          status: "error",
          message: access.message,
        });
      }

      const deleted = await tasks.deleteForUser(id, req.user.id);

      if (!deleted) {
        return res.status(404).json({
          status: "error",
          message: "Task not found",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Task deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createTaskRouter;
