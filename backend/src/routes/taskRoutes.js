const express = require("express");
const taskStore = require("../data/taskStore");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({ status: "success", data: taskStore.getAll() });
});

router.post("/", (req, res) => {
  const title = (req.body.title || "").trim();
  if (!title) {
    return res.status(400).json({ status: "error", message: "Title is required" });
  }
  const task = taskStore.create(title);
  res.status(201).json({ status: "success", data: task });
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ status: "error", message: "Invalid task id" });
  }
  const deleted = taskStore.remove(id);
  if (!deleted) {
    return res.status(404).json({ status: "error", message: "Task not found" });
  }
  res.status(200).json({ status: "success", message: "Task deleted successfully" });
});

module.exports = router;
