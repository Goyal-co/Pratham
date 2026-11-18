import pg from "pg";
import bcrypt from "bcryptjs";

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}
const connectionString = raw
  .replace(/([?&])sslmode=[^&]*/gi, "$1")
  .replace(/\?&/, "?")
  .replace(/[?&]$/, "");

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const db = await client.query("select current_database() as db, current_user as u");
  console.log("Connected:", db.rows[0]);

  const tables = await client.query(
    "select tablename from pg_tables where schemaname = 'public' order by 1"
  );
  console.log(
    "Tables:",
    tables.rows.map((r) => r.tablename).join(", ")
  );

  const admins = await client.query(
    "select email, role, full_name, created_at from users where role = 'admin' order by created_at"
  );
  console.log("Admins:");
  for (const a of admins.rows) {
    console.log(" -", a.email, "|", a.full_name, "|", a.created_at);
  }

  const students = await client.query(
    "select count(*)::int as c from users where role = 'student'"
  );
  console.log("Student count:", students.rows[0].c);

  const target = await client.query(
    "select email, role, full_name, password_hash from users where lower(email) = lower($1)",
    ["titanscortex@gmail.com"]
  );
  if (!target.rows[0]) {
    console.log("STATUS: titanscortex@gmail.com NOT FOUND — seeding now...");
  } else {
    const ok = await bcrypt.compare("Titans@$#123", target.rows[0].password_hash);
    console.log("Target admin:", {
      email: target.rows[0].email,
      role: target.rows[0].role,
      full_name: target.rows[0].full_name,
      password_matches_Admin1234: ok,
    });
  }

  const legacy = await client.query(
    "select email from users where email = 'admin@pratham.local'"
  );
  console.log(
    "Legacy admin@pratham.local:",
    legacy.rows[0]?.email || "none"
  );

  const settings = await client.query(
    "select breakfast_cutoff, lunch_cutoff, dinner_cutoff, default_credit_limit from app_settings where id = 1"
  );
  console.log("Settings:", settings.rows[0]);
} finally {
  await client.end();
}
