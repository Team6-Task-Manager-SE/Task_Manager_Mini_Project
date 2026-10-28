
require("dotenv").config();

const fs = require("node:fs");
const https = require("node:https");
const app = require("./app");
const pool = require("./config/database");
const redisClient = require("./config/redis");
const runMigrations = require("./scripts/migrate");

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
  // Production must never expose this application over plain HTTP.
  if (isProduction && process.env.DB_SSL !== "true") {
    throw new Error("Production requires DB_SSL=true");
  }

  await runMigrations(pool);

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  let server;

  if (isProduction || process.env.HTTPS_KEY_PATH || process.env.HTTPS_CERT_PATH) {
    server = createHttpsServer();
  } else {
    // HTTP is for local development only.
    server = require("node:http").createServer(app);
  }

  server.listen(PORT, () => {
    console.log(
      `Task Manager backend running on ${isProduction || process.env.HTTPS_KEY_PATH || process.env.HTTPS_CERT_PATH ? "HTTPS" : "HTTP"} port ${PORT}`
    );
  });

  async function shutdown() {
    server.close(async () => {
      try {
        if (redisClient.isOpen) await redisClient.quit();
        await pool.end();
        process.exit(0);
      } catch (error) {
        console.error("Shutdown failed:", error);
        process.exit(1);
      }
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error("Backend startup failed:", error);
  process.exit(1);
});
