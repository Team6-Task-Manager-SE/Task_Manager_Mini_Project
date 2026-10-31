
require("dotenv").config();

const fs = require("node:fs");
const https = require("node:https");
const http = require("node:http");

const app = require("./app");
const pool = require("./config/database");
const redisClient = require("./config/redis");
const runMigrations = require("./scripts/migrate");

const {
  startNotificationScheduler,
} = require("./workers/notificationScheduler");

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

  // Apply pending database migrations.
  await runMigrations(pool);

  // Connect Redis if it is not already connected.
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  let server;

  const useHttps =
    isProduction ||
    Boolean(process.env.HTTPS_KEY_PATH) ||
    Boolean(process.env.HTTPS_CERT_PATH);

  if (useHttps) {
    server = createHttpsServer();
  } else {
    server = http.createServer(app);
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
    stopNotificationScheduler =
      startNotificationScheduler(pool);
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

      if (redisClient.isOpen) {
        await redisClient.quit();
      }

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
