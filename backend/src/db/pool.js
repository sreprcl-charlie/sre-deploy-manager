const { Pool } = require("pg");
require("dotenv").config({
  path: require("path").join(__dirname, "../../.env"),
});

// Railway menyediakan DATABASE_URL; fallback ke individual vars untuk dev lokal
// Set DATABASE_SSL=false jika postgres lokal tidak pakai SSL
const useSSL = process.env.DATABASE_SSL !== "false";
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ...(useSSL && { ssl: { rejectUnauthorized: false } }),
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

pool.on("error", (err) => {
  console.error("[DB] Unexpected error on idle client", err);
  process.exit(-1);
});

module.exports = pool;
