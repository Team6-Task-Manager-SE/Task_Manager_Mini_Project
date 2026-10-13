const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Task Manager Backend is running",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Task Manager API is healthy",
  });
});

module.exports = app;