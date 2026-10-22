const fs = require("node:fs/promises");
const path = require("node:path");
require("dotenv").config();

const pool = require("../config/database");

async function runMigrations(database = pool) {
  const migrationsDirectory = path.join(__dirname, "..", "..", "migrations");
  const filenames = (await fs.readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  for (const filename of filenames) {
    const sql = await fs.readFile(path.join(migrationsDirectory, filename), "utf8");
    await database.query(sql);
    console.log(`Applied migration: ${filename}`);
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((error) => {
      console.error("Database migration failed:", error.message);
      process.exitCode = 1;
    });
}

module.exports = runMigrations;
