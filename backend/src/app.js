
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const pool = require("./config/database");
const redisClient = require("./config/redis");

// Authentication
const {
  createUserRepository,
} = require("./repositories/userRepository");

const {
  createAuthService,
} = require("./services/authService");

const createEmailService = require("./services/emailService");

const createAuthController = require("./controllers/authController");
const createAuthRouter = require("./routes/authRoutes");

// Task Management
const {
  createTaskRepository,
} = require("./repositories/taskRepository");

const createTaskRouter = require("./routes/taskRoutes");

// Sprint 2 Issue #19 - Due-Date Notifications
const createNotificationRouter = require("./routes/notificationRoutes");

// Sprint 2 Issue #25 - Weekly Productivity Reports
const {
  createWeeklyReportRepository,
} = require("./repositories/weeklyReportRepository");

const createWeeklyReportRouter = require("./routes/weeklyReportRoutes");

function createApp(dependencies = {}) {
  // Database and external services
  const database = dependencies.pool || pool;
  const cache = dependencies.redisClient || redisClient;

  // Repositories
  const users =
    dependencies.users || createUserRepository(database);

  const tasks =
    dependencies.tasks || createTaskRepository(database);

  const reports =
    dependencies.reports ||
    createWeeklyReportRepository(database);

  // Authentication services
  const emailService =
    dependencies.emailService || createEmailService();

  const authService =
    dependencies.authService ||
    createAuthService({
      users,
      emailService,
    });

  const authController = createAuthController({
    authService,
    users,
  });

  // Initialize Express
  const app = express();

  app.disable("x-powered-by");

  // Security middleware
  app.use(helmet());

  app.use(
    cors({
      origin:
        process.env.FRONTEND_URL ||
        "http://127.0.0.1:5173",
    })
  );

  app.use(
    express.json({
      limit: "32kb",
    })
  );

  // Root endpoint
  app.get("/", (req, res) => {
    return res.json({
      message: "Task Manager Backend is running",
    });
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    return res.status(200).json({
      status: "success",
      message: "Task Manager API is healthy",
    });
  });

  // Authentication API
  app.use(
    "/api/auth",
    createAuthRouter({
      controller: authController,
      redisClient: cache,
    })
  );

  // Task Management API
  app.use(
    "/api/tasks",
    createTaskRouter({
      tasks,
    })
  );

  // Due-Date Notifications API
  app.use(
    "/api/notifications",
    createNotificationRouter({
      pool: database,
    })
  );

  // Weekly Productivity Reports API
  app.use(
    "/api/reports",
    createWeeklyReportRouter({
      reports,
    })
  );

  // Global error handler
  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
      console.error(error);
    }

    return res.status(statusCode).json({
      status: "error",
      code: error.code || "INTERNAL_ERROR",
      message:
        statusCode >= 500
          ? "An unexpected error occurred"
          : error.message,
    });
  });

  return app;
}

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;
