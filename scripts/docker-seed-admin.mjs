/**
 * Ensure admin exists from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
 * Usage: node scripts/docker-seed-admin.mjs
 */
import pg from "pg";

async function hashPassword(password) {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.hash(password, 10);
}

const databaseUrl = process.env.DATABASE_URL;
const email = String(process.env.ADMIN_EMAIL || "")
  .trim()
  .toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || "");
const fullName = String(process.env.ADMIN_NAME || "Ahariva Admin").trim();

if (!databaseUrl) {
  console.error("DATABASE_URL required");
  process.exit(1);
}
if (!email || !password) {
  console.log("ADMIN_EMAIL/ADMIN_PASSWORD not set — skip admin seed");
  process.exit(0);
}

function useSsl(url) {
  if (process.env.DATABASE_SSL === "true") return true;
  if (process.env.DATABASE_SSL === "false") return false;
  return /sslmode=require|rds\.amazonaws|neon\.tech|supabase/i.test(url);
}

function parseDatabaseUrl(raw) {
  const matched = String(raw || "")
    .trim()
    .match(
      /^(?:jdbc:)?postgres(?:ql)?:\/\/([^:\/?#]+):(.+)@([^:\/?#]+)(?::(\d+))?\/([^?\/#]+)(?:\?.*)?$/i
    );
  if (!matched) return null;
  let pwd = matched[2];
  try {
    pwd = decodeURIComponent(pwd);
  } catch {
    /* keep */
  }
  return {
    user: decodeURIComponent(matched[1]),
    password: pwd,
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
  return new pg.Client({
    connectionString: databaseUrl
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/\?&/, "?")
      .replace(/[?&]$/, ""),
    ssl,
  });
}

const client = makeClient();
await client.connect();
try {
  const { rows } = await client.query(
    `select id from users where email = $1`,
    [email]
  );
  const hash = await hashPassword(password);
  if (rows[0]) {
    await client.query(
      `update users
       set password_hash = $1, role = 'admin', full_name = $2
       where email = $3`,
      [hash, fullName, email]
    );
    console.log(`Admin updated: ${email}`);
  } else {
    await client.query(
      `delete from users where role = 'admin' and email <> $1`,
      [email]
    );
    await client.query(
      `insert into users (email, password_hash, role, full_name)
       values ($1,$2,'admin',$3)`,
      [email, hash, fullName]
    );
    console.log(`Admin created: ${email}`);
  }
} finally {
  await client.end();
}
