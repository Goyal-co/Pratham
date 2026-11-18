/**
 * Minimal migrate runner for the Docker image (no bcrypt / compose deps).
 * Usage: node scripts/docker-migrate.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

function useSsl(url) {
  if (process.env.DATABASE_SSL === "true") return true;
  if (process.env.DATABASE_SSL === "false") return false;
  return /sslmode=require|rds\.amazonaws|neon\.tech|supabase/i.test(url);
}

const connectionString = databaseUrl
  .replace(/([?&])sslmode=[^&]*/gi, "$1")
  .replace(/\?&/, "?")
  .replace(/[?&]$/, "");

const files = [
  "db/migrations/001_init.sql",
  "db/migrations/002_audit_log.sql",
  "db/migrations/003_daily_menu_reminders.sql",
  "db/migrations/004_password_reset.sql",
  "db/migrations/005_credit_hold_until_delivered.sql",
  "db/migrations/006_wallet_primary_balance.sql",
  "db/migrations/007_perf_indexes_and_media.sql",
];

const client = new pg.Client({
  connectionString,
  ssl: useSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
try {
  for (const file of files) {
    const path = resolve(root, file);
    if (!existsSync(path)) {
      console.warn(`skip missing ${file}`);
      continue;
    }
    console.log(`Applying ${file}...`);
    await client.query(readFileSync(path, "utf8"));
  }
  console.log("Migrations complete.");
} finally {
  await client.end();
}
