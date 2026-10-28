const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pool = require("./config/database");
const redisClient = require("./config/redis");
const { createUserRepository } = require("./repositories/userRepository");
const { createAuthService } = require("./services/authService");
const createEmailService = require("./services/emailService");
const createAuthController = require("./controllers/authController");
const createAuthRouter = require("./routes/authRoutes");
const { createTaskRepository } = require("./repositories/taskRepository");
const createTaskRouter = require("./routes/taskRoutes");

function createApp(dependencies = {}) {
  const database = dependencies.pool || pool;
  const tasks = dependencies.tasks || createTaskRepository(database);
  const cache = dependencies.redisClient || redisClient;
  const users = dependencies.users || createUserRepository(database);
  const emailService = dependencies.emailService || createEmailService();
  const authService = dependencies.authService || createAuthService({ users, emailService });
  const authController = createAuthController({ authService, users });
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: process.env.FRONTEND_URL || "http://127.0.0.1:5173" }));
  app.use(express.json({ limit: "32kb" }));

  app.get("/", (req, res) => {
    res.json({ message: "Task Manager Backend is running" });
  });

  app.get("/api/health", (req, res) => {
    res.status(200).json({
      status: "success",
      message: "Task Manager API is healthy",
    });
  });

  app.use("/api/auth", createAuthRouter({ controller: authController, redisClient: cache }));
  app.use("/api/tasks", createTaskRouter({ tasks }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error(error);
    return res.status(statusCode).json({
      status: "error",
      code: error.code || "INTERNAL_ERROR",
      message: statusCode >= 500 ? "An unexpected error occurred" : error.message,
    });
  });

  return app;
}

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;
