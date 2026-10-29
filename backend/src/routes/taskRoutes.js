
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

  router.use(authenticate);

  router.use((req, res, next) => {
    if (!req.user || req.user.id == null) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
    }
    next();
  });

  router.use(authorizeRoles("user", "admin"));

  router.get("/", async (req, res, next) => {
    try {
      const data = await tasks.getAllForUser(req.user.id);
      return res.status(200).json({ status: "success", data });
    } catch (error) {
      next(error);
    }
  });

  router.get("/summary", async (req, res, next) => {
    try {
      const data = await tasks.getSummaryForUser(req.user.id);
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
          const parsedProjectId = Number(projectId);

          if (
            !Number.isSafeInteger(parsedProjectId) ||
            parsedProjectId <= 0
          ) {
            return res.status(400).json({
              status: "error",
              message: "Invalid project id",
            });
          }

          const allowed = await tasks.canAccessProject(
            parsedProjectId,
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
          priority: req.body.priority,
          tags: req.body.tags,
          category: req.body.category,
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
          priority: req.body.priority,
          tags: req.body.tags,
          category: req.body.category,
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
