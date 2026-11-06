
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

const {
  createTaskCommentRepository,
} = require("./repositories/taskCommentRepository");

const createTaskCommentRouter = require("./routes/taskCommentRoutes");
const createTaskRouter = require("./routes/taskRoutes");

// Project and Kanban board support.
const { createProjectRepository } = require("./repositories/projectRepository");
const createProjectRouter = require("./routes/projectRoutes");

// Sprint 2 Issue #19 - Due-Date Notifications
const createNotificationRouter = require("./routes/notificationRoutes");

// Sprint 2 Issue #25 - Weekly Productivity Reports
const {
  createWeeklyReportRepository,
} = require("./repositories/weeklyReportRepository");

const createWeeklyReportRouter = require("./routes/weeklyReportRoutes");

// Sprint 2 Issue #22 - Team Member Invitations (F-040)
const {
  createProjectInvitationRepository,
} = require("./repositories/projectInvitationRepository");

const {
  createProjectInvitationService,
} = require("./services/projectInvitationService");

const createProjectInvitationRouter = require("./routes/projectInvitationRoutes");

// Sprint 2 Issue #26 - Admin usage analytics
const {
  createAdminAnalyticsRepository,
} = require("./repositories/adminAnalyticsRepository");
const createAdminAnalyticsRouter = require("./routes/adminAnalyticsRoutes");

function createApp(dependencies = {}) {
  // Database and external services
  const database = dependencies.pool || pool;
  const cache = dependencies.redisClient || redisClient;
  const comments = 
    dependencies.comments || createTaskCommentRepository(database);

  // Repositories
  const users =
    dependencies.users || createUserRepository(database);

  const tasks =
    dependencies.tasks || createTaskRepository(database);

  const projects =
    dependencies.projects || createProjectRepository(database);

  const reports =
    dependencies.reports ||
    createWeeklyReportRepository(database);

  const analytics =
    dependencies.analytics ||
    createAdminAnalyticsRepository(database);

  // F-040 Invitation Repository
  const invitations =
    dependencies.invitations ||
    createProjectInvitationRepository(database);

  // Email Service
  const emailService =
    dependencies.emailService || createEmailService();

  // Authentication Service
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

  // F-040 Invitation Service
  const invitationService =
    dependencies.invitationService ||
    createProjectInvitationService({
      invitationRepository: invitations,
      emailService,
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

  app.use(
    "/api/projects",
    createProjectRouter({ projects })
  );

  // F-042 Task Comments API
  app.use(
   "/api/tasks",
    createTaskCommentRouter({
      tasks,
      comments,
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

  // F-040 Team Member Invitations API
  app.use(
    "/api/v1",
    createProjectInvitationRouter({
      invitationService,
    })
  );

  app.use(
    "/api/admin",
    createAdminAnalyticsRouter({ analytics })
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
