const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || undefined,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL connection error:", error.message);
});

module.exports = pool;
