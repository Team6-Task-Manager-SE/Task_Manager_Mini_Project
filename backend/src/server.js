require("dotenv").config();

const fs = require("node:fs");
const https = require("node:https");
const http = require("node:http");
const { createAdapter } = require("@socket.io/redis-adapter");

const app = require("./app");
const pool = require("./config/database");
const redisClient = require("./config/redis");
const runMigrations = require("./scripts/migrate");

const {
  startNotificationScheduler,
} = require("./workers/notificationScheduler");

const {
  createCommentSocketService,
} = require("./services/commentSocketService");

const {
  createTaskRepository,
} = require("./repositories/taskRepository");

const PORT = Number(process.env.PORT || 5000);
const isProduction = process.env.NODE_ENV === "production";

function createHttpsServer() {
  const keyPath = process.env.HTTPS_KEY_PATH;
  const certPath = process.env.HTTPS_CERT_PATH;

  if (!keyPath || !certPath) {
    throw new Error(
      "HTTPS_KEY_PATH and HTTPS_CERT_PATH are required for HTTPS."
    );
  }

  return https.createServer(
    {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
      minVersion: "TLSv1.2",
    },
    app
  );
}

async function start() {
  // Production must use encrypted database connections.
  if (isProduction && process.env.DB_SSL !== "true") {
    throw new Error("Production requires DB_SSL=true");
  }

  // Run database migrations.
  if (process.env.RUN_MIGRATIONS_ON_START !== "false") {
    await runMigrations(pool);
  }

  // Redis configuration.
  const useDevelopmentRateLimitFallback =
    !isProduction && process.env.DEV_DISABLE_REDIS === "true";

  if (useDevelopmentRateLimitFallback) {
    console.warn(
      "Redis disabled for development; using in-memory auth rate limiting."
    );
  } else if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  let server;
  let socketPubClient;
  let socketSubClient;

  const tlsTerminatedAtProxy =
    process.env.TLS_TERMINATED_AT_PROXY === "true";

  const useHttps =
    !tlsTerminatedAtProxy &&
    (
      isProduction ||
      Boolean(process.env.HTTPS_KEY_PATH) ||
      Boolean(process.env.HTTPS_CERT_PATH)
    );

  // Create HTTP or HTTPS server.
  if (useHttps) {
    server = createHttpsServer();
  } else {
    server = http.createServer(app);
  }

  // F-042: Initialize authenticated real-time Socket.IO service.
  const tasks = createTaskRepository(pool);

  const commentSocketService = createCommentSocketService(server, {
    tasks,
  });

  // Make Socket.IO available to the application and F-032 notification service.
  app.set("io", commentSocketService.io);

  // Share Socket.IO rooms and broadcasts across backend replicas.
  // Local development can opt out with the in-memory auth rate-limit fallback.
  if (!useDevelopmentRateLimitFallback) {
    socketPubClient = redisClient.duplicate();
    socketSubClient = redisClient.duplicate();

    socketPubClient.on("error", (error) =>
      console.error("Socket.IO Redis publisher error:", error.message)
    );

    socketSubClient.on("error", (error) =>
      console.error("Socket.IO Redis subscriber error:", error.message)
    );

    await Promise.all([
      socketPubClient.connect(),
      socketSubClient.connect(),
    ]);

    commentSocketService.io.adapter(
      createAdapter(socketPubClient, socketSubClient)
    );
  }

  let stopNotificationScheduler = () => {};

  // Start backend server.
  server.listen(PORT, () => {
    console.log(
      `Task Manager backend running on ${
        useHttps ? "HTTPS" : "HTTP"
      } port ${PORT}`
    );

    // Start the notification scheduler after the server starts.
    stopNotificationScheduler = startNotificationScheduler(pool);
  });

  let shuttingDown = false;

  async function shutdown() {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    console.log("Shutting down Task Manager backend...");

    // Stop creating new notification checks.
    stopNotificationScheduler();

    // Close Socket.IO connections.
    commentSocketService.io.disconnectSockets(true);

    try {
      // Stop accepting new HTTP requests.
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      // Close Redis connections.
      if (redisClient.isOpen) {
        if (socketPubClient?.isOpen) {
          await socketPubClient.quit();
        }

        if (socketSubClient?.isOpen) {
          await socketSubClient.quit();
        }

        await redisClient.quit();
      }

      // Close database connection pool.
      await pool.end();

      console.log("Backend shutdown completed.");
      process.exit(0);
    } catch (error) {
      console.error("Shutdown failed:", error);
      process.exit(1);
    }
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error("Backend startup failed:", error);
  process.exit(1);
});
