const express = require("express");

const taskStore = require("../data/taskStore");

const {
  createTaskRules,
  updateTaskRules,
} = require("../validators/taskValidators");

const validateRequest = require("../middleware/validateRequest");
const authenticate = require("../middleware/authenticate");

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

router.use(authenticate);
router.use(requireUser);

// Get tasks belonging to authenticated user
router.get("/", (req, res) => {
  return res.status(200).json({
    status: "success",
    data: taskStore.getAll(req.user.id),
  });
});

// Create task
router.post(
  "/",
  createTaskRules,
  validateRequest,
  (req, res) => {
    const task = taskStore.create({
      title: req.body.title,
      description: req.body.description || "",
      dueDate: req.body.dueDate || null,
      ownerId: req.user.id,
    });

    return res.status(201).json({
      status: "success",
      message: "Task created successfully",
      data: task,
    });
  }
);

// Edit task and manage task status
router.patch(
  "/:id",
  updateTaskRules,
  validateRequest,
  (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid task id",
      });
    }

    const task = taskStore.getById(id);

    if (!task) {
      return res.status(404).json({
        status: "error",
        message: "Task not found",
      });
    }

    if (task.ownerId !== Number(req.user.id)) {
      return res.status(403).json({
        status: "error",
        message: "You are not allowed to access this task",
      });
    }

    const updatedTask = taskStore.update(
      id,
      req.user.id,
      {
        title: req.body.title,
        description: req.body.description,
        dueDate: req.body.dueDate,
        status: req.body.status,
      }
    );

    return res.status(200).json({
      status: "success",
      message: "Task updated successfully",
      data: updatedTask,
    });
  }
);

// Delete task
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: "error",
      message: "Invalid task id",
    });
  }

  const task = taskStore.getById(id);

  if (!task) {
    return res.status(404).json({
      status: "error",
      message: "Task not found",
    });
  }

  if (task.ownerId !== Number(req.user.id)) {
    return res.status(403).json({
      status: "error",
      message: "You are not allowed to access this task",
    });
  }

  taskStore.remove(id, req.user.id);

  return res.status(200).json({
    status: "success",
    message: "Task deleted successfully",
  });
});

module.exports = router;