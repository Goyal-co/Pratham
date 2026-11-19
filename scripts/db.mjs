import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";

const root = resolve(import.meta.dirname, "..");

/** Load KEY=VAL from env files without overriding existing process.env. */
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] != null && process.env[key] !== "") continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile(resolve(root, "apps/admin/.env.local"));
loadEnvFile(resolve(root, ".env"));

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5434/pratham";

function useSsl(url) {
  if (process.env.DATABASE_SSL === "true") return true;
  if (process.env.DATABASE_SSL === "false") return false;
  return /sslmode=require|rds\.amazonaws|neon\.tech|supabase/i.test(url);
}

/** Parse DATABASE_URL even when password contains @ (e.g. Mst@2069). */
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

function pgClient() {
  const host = process.env.DATABASE_HOST || process.env.PGHOST;
  const user = process.env.DATABASE_USER || process.env.PGUSER;
  const password = process.env.DATABASE_PASSWORD ?? process.env.PGPASSWORD;
  const database = process.env.DATABASE_NAME || process.env.PGDATABASE;
  const port = Number(process.env.DATABASE_PORT || process.env.PGPORT || 5432);
  const sslHost = host || databaseUrl;
  const ssl = useSsl(sslHost) ? { rejectUnauthorized: false } : undefined;

  if (host && user && password != null && database) {
    return new pg.Client({
      host,
      port: Number.isFinite(port) ? port : 5432,
      user,
      password,
      database,
      ssl,
    });
  }

  const parsed = parseDatabaseUrl(databaseUrl);
  if (parsed) {
    return new pg.Client({
      host: parsed.host,
      port: Number.isFinite(parsed.port) ? parsed.port : 5432,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      ssl: useSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    });
  }

  // Fallback: strip sslmode from URL
  const connectionString = databaseUrl
    .replace(/([?&])sslmode=[^&]*/i, "$1")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
  return new pg.Client({
    connectionString,
    ssl: useSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    ...opts,
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const action = process.argv[2];

if (action === "up") {
  run("docker", ["compose", "up", "-d"]);
} else if (action === "down") {
  run("docker", ["compose", "down"]);
} else if (action === "create-db") {
  // Connect to default maintenance DB and create target DB if missing
  const u = new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, "http://"));
  const dbName = decodeURIComponent(u.pathname.replace(/^\//, "") || "pratham");
  u.pathname = "/postgres";
  const adminUrl = u.toString().replace(/^http/, "postgres");
  const connectionString = adminUrl
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
  const client = new pg.Client({
    connectionString,
    ssl: useSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    const exists = await client.query(
      `select 1 from pg_database where datname = $1`,
      [dbName]
    );
    if (exists.rowCount) {
      console.log(`Database "${dbName}" already exists.`);
    } else {
      await client.query(`create database "${dbName}"`);
      console.log(`Created database "${dbName}".`);
    }
  } finally {
    await client.end();
  }
} else if (action === "migrate") {
  const files = [
    "db/migrations/001_init.sql",
    "db/migrations/002_audit_log.sql",
    "db/migrations/003_daily_menu_reminders.sql",
    "db/migrations/004_password_reset.sql",
    "db/migrations/005_credit_hold_until_delivered.sql",
    "db/migrations/006_wallet_primary_balance.sql",
    "db/migrations/007_perf_indexes_and_media.sql",
  ];
  const client = pgClient();
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
} else if (action === "seed" || action === "seed:admin") {
  // Production-safe: admin only (no demo students)
  const client = pgClient();
  await client.connect();
  try {
    const email = String(process.env.ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();
    const password = String(process.env.ADMIN_PASSWORD || "");
    const fullName = String(
      process.env.ADMIN_NAME || "Ahariva Admin"
    ).trim();
    if (!email || !password) {
      throw new Error(
        "Set ADMIN_EMAIL and ADMIN_PASSWORD in apps/admin/.env.local (or the environment) before seeding"
      );
    }
    const adminHash = await bcrypt.hash(password, 10);
    // Drop any other admins so only the intended account remains
    await client.query(`delete from users where role = 'admin' and email <> $1`, [
      email,
    ]);
    await client.query(
      `insert into users (email, password_hash, role, full_name)
       values ($1,$2,'admin',$3)
       on conflict (email) do update
         set role = 'admin',
             password_hash = excluded.password_hash,
             full_name = excluded.full_name`,
      [email, adminHash, fullName]
    );
    console.log("Admin seed complete.");
    console.log(`Admin login: ${email} / (password you set)`);
    console.log(
      "Students are NOT seeded — they sign up in the student app (Create account)."
    );
  } finally {
    await client.end();
  }
} else if (action === "purge" || action === "seed:purge") {
  // Keep admin users + app_settings; wipe students and operational data
  const client = pgClient();
  await client.connect();
  try {
    await client.query("begin");
    // Break cycles / clear ops data first
    await client.query(`truncate table
      reminder_log,
      menu_day_pubs,
      plan_cancellations,
      referrals,
      ledger_entries,
      notifications,
      push_tokens,
      password_reset_tokens,
      media_assets,
      orders,
      fixed_plans,
      student_accounts,
      audit_logs,
      menu_items
      restart identity cascade`);
    const { rowCount } = await client.query(
      `delete from users where role <> 'admin'`
    );
    await client.query("commit");
    const admins = await client.query(
      `select email, full_name from users where role = 'admin' order by email`
    );
    console.log(`Purged non-admin users: ${rowCount ?? 0}`);
    console.log("Kept admins:");
    for (const a of admins.rows) {
      console.log(` - ${a.email} (${a.full_name || "—"})`);
    }
  } catch (e) {
    await client.query("rollback").catch(() => null);
    throw e;
  } finally {
    await client.end();
  }
} else if (action === "wipe") {
  // Full wipe: all users (including admins) + all operational data
  const client = pgClient();
  await client.connect();
  try {
    await client.query("begin");
    await client.query(`truncate table
      reminder_log,
      menu_day_pubs,
      plan_cancellations,
      referrals,
      ledger_entries,
      notifications,
      push_tokens,
      password_reset_tokens,
      media_assets,
      orders,
      fixed_plans,
      student_accounts,
      audit_logs,
      menu_items,
      users,
      app_settings
      restart identity cascade`);
    await client.query(`insert into app_settings (id) values (1) on conflict (id) do nothing`);
    await client.query("commit");
    console.log("Full wipe complete (all users + data). app_settings reset to defaults.");
  } catch (e) {
    await client.query("rollback").catch(() => null);
    throw e;
  } finally {
    await client.end();
  }
} else if (action === "seed:demo") {
  // Optional local/demo data only
  const client = pgClient();
  await client.connect();
  try {
    const hash = await bcrypt.hash("password123", 10);
    const students = [
      {
        id: "11111111-1111-1111-1111-111111111101",
        email: "rahul@demo.local",
        name: "Rahul Sharma",
        phone: "9876543210",
        hostel: "Sunrise PG",
        room: "204",
        code: "RAHUL001",
      },
      {
        id: "11111111-1111-1111-1111-111111111102",
        email: "aditi@demo.local",
        name: "Aditi Singh",
        phone: "9812234567",
        hostel: "Lotus Hostel",
        room: "12",
        code: "ADITI002",
      },
    ];
    for (const s of students) {
      await client.query(
        `insert into users (id, email, password_hash, role, full_name, phone, hostel, room, referral_code)
         values ($1,$2,$3,'student',$4,$5,$6,$7,$8)
         on conflict (email) do update set password_hash = excluded.password_hash`,
        [s.id, s.email, hash, s.name, s.phone, s.hostel, s.room, s.code]
      );
      await client.query(
        `insert into student_accounts (student_id, credit_limit)
         values ($1, 500)
         on conflict (student_id) do nothing`,
        [s.id]
      );
    }
    console.log("Demo students: rahul@demo.local, aditi@demo.local / password123");
  } finally {
    await client.end();
  }
} else {
  console.log(
    "Usage: node scripts/db.mjs <up|down|create-db|migrate|seed|seed:admin|seed:demo|purge|wipe>"
  );
  process.exit(1);
}
