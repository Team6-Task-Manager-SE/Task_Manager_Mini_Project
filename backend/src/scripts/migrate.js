
const fs = require("node:fs/promises");
const path = require("node:path");
require("dotenv").config();

const pool = require("../config/database");

async function runMigrations(database = pool) {
  const migrationsDirectory = path.join(__dirname, "..", "..", "migrations");

  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const filenames = (await fs.readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  for (const filename of filenames) {
    const alreadyApplied = await database.query(
      "SELECT 1 FROM schema_migrations WHERE filename = $1",
      [filename]
    );

    if (alreadyApplied.rowCount > 0) {
      console.log(`Skipping already applied migration: ${filename}`);
      continue;
    }

    const sql = await fs.readFile(
      path.join(migrationsDirectory, filename),
      "utf8"
    );

    const client = await database.connect();

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [filename]
      );
      await client.query("COMMIT");
      console.log(`Applied migration: ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((error) => {
      console.error("Database migration failed:", error.message);
      process.exitCode = 1;
      pool.end();
    });
}

module.exports = runMigrations;
