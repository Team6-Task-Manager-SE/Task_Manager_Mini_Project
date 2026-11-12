require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const isProduction = process.env.NODE_ENV === "production";
const databaseTlsEnabled = process.env.DB_SSL === "true";
if (isProduction && !databaseTlsEnabled) {
  throw new Error("Production requires DB_SSL=true");
}

let ssl;

if (databaseTlsEnabled) {
  const caPath = process.env.DB_SSL_CA_PATH;
  ssl = {
    rejectUnauthorized: true,
    ...(caPath ? { ca: fs.readFileSync(caPath, "utf8") } : {}),
    minVersion: "TLSv1.2",
  };
}

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || undefined,
  ...(databaseTlsEnabled ? { ssl } : {}),
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL connection error:", error.message);
});
module.exports = pool;
