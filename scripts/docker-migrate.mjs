/**
 * Idempotent schema ensure for Docker / prod.
 * Creates enums, tables, indexes if missing (safe to re-run).
 * Handles DATABASE_URL passwords that contain @.
 *
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

/** Parse postgres URLs even when password contains @. */
function parseDatabaseUrl(raw) {
  const matched = String(raw || "")
    .trim()
    .match(
      /^(?:jdbc:)?postgres(?:ql)?:\/\/([^:\/?#]+):(.+)@([^:\/?#]+)(?::(\d+))?\/([^?\/#]+)(?:\?.*)?$/i
    );
  if (!matched) return null;
  let password = matched[2];
  try {
    password = decodeURIComponent(password);
  } catch {
    /* keep raw */
  }
  return {
    user: decodeURIComponent(matched[1]),
    password,
    host: matched[3],
    port: matched[4] ? Number(matched[4]) : 5432,
    database: decodeURIComponent(matched[5]),
  };
}

function makeClient() {
  const ssl = useSsl(databaseUrl)
    ? { rejectUnauthorized: false }
    : undefined;
  const parsed = parseDatabaseUrl(databaseUrl);
  if (parsed) {
    return new pg.Client({
      host: parsed.host,
      port: Number.isFinite(parsed.port) ? parsed.port : 5432,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      ssl,
    });
  }
  const connectionString = databaseUrl
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
  return new pg.Client({ connectionString, ssl });
}

const files = [
  "db/migrations/001_init.sql",
  "db/migrations/002_audit_log.sql",
  "db/migrations/003_daily_menu_reminders.sql",
  "db/migrations/004_password_reset.sql",
  "db/migrations/005_credit_hold_until_delivered.sql",
  "db/migrations/006_wallet_primary_balance.sql",
  "db/migrations/007_perf_indexes_and_media.sql",
];

const client = makeClient();
await client.connect();
try {
  const exists = await client.query(
    `select to_regclass('public.users') is not null as ok`
  );
  const hadUsers = !!exists.rows[0]?.ok;
  if (!hadUsers) {
    console.log("Schema missing (users table not found) — creating tables...");
  } else {
    console.log("Ensuring schema is up to date (idempotent migrations)...");
  }

  for (const file of files) {
    const path = resolve(root, file);
    if (!existsSync(path)) {
      console.warn(`skip missing ${file}`);
      continue;
    }
    console.log(`Applying ${file}...`);
    await client.query(readFileSync(path, "utf8"));
  }

  await client.query(
    `insert into app_settings (id) values (1) on conflict (id) do nothing`
  );

  const tables = await client.query(
    `select tablename from pg_tables
     where schemaname = 'public'
     order by tablename`
  );
  console.log(
    "Migrations complete. Tables:",
    tables.rows.map((r) => r.tablename).join(", ")
  );
} finally {
  await client.end();
}
