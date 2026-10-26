require("dotenv").config();

const app = require("./app");
const pool = require("./config/database");
const redisClient = require("./config/redis");
const runMigrations = require("./scripts/migrate");

const PORT = process.env.PORT || 5000;

async function start() {
  await runMigrations(pool);
  if (!redisClient.isOpen) await redisClient.connect();

  const server = app.listen(PORT, () => {
    console.log(`Task Manager backend running on port ${PORT}`);
  });

  async function shutdown() {
    server.close(async () => {
      if (redisClient.isOpen) await redisClient.quit();
      await pool.end();
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error("Backend startup failed:", error);
  process.exit(1);
});
