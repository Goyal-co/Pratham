import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";

const root = resolve(import.meta.dirname, "..");
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5434/pratham";

function useSsl(url) {
  if (process.env.DATABASE_SSL === "true") return true;
  if (process.env.DATABASE_SSL === "false") return false;
  return /sslmode=require|rds\.amazonaws|neon\.tech|supabase/i.test(url);
}

function pgClient() {
  // Strip sslmode from URL so node-pg doesn't force verify-full (breaks RDS chains)
  const connectionString = databaseUrl.replace(
    /([?&])sslmode=[^&]*/i,
    "$1"
  ).replace(/\?&/, "?").replace(/[?&]$/, "");
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
    const email = (process.env.ADMIN_EMAIL || "admin@gmail.com").toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "Admin@1234";
    const fullName = process.env.ADMIN_NAME || "Tiffin Admin";
    const adminHash = await bcrypt.hash(password, 10);
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
    "Usage: node scripts/db.mjs <up|down|create-db|migrate|seed|seed:admin|seed:demo>"
  );
  process.exit(1);
}
