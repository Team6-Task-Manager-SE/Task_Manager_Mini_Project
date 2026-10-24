const express = require("express");

const taskStore = require("../data/taskStore");
const { createTaskRules } = require("../validators/taskValidators");
const validateRequest = require("../middleware/validateRequest");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    data: taskStore.getAll(),
  });
});

router.post("/", createTaskRules, validateRequest, (req, res) => {
  const task = taskStore.create({
    title: req.body.title,
    description: req.body.description || "",
    dueDate: req.body.dueDate || null,
  });

  res.status(201).json({
    status: "success",
    message: "Task created successfully",
    data: task,
  });
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      status: "error",
      message: "Invalid task id",
    });
  }

  const deleted = taskStore.remove(id);

  if (!deleted) {
    return res.status(404).json({
      status: "error",
      message: "Task not found",
    });
  }

  res.status(200).json({
    status: "success",
    message: "Task deleted successfully",
  });
});

module.exports = router;
