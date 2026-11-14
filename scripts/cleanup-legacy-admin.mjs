import pg from "pg";

const raw = process.env.DATABASE_URL;
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
  const del = await client.query(
    `delete from users where email = 'admin@pratham.local' returning email`
  );
  console.log("Removed:", del.rows.map((r) => r.email));
  const left = await client.query(
    `select email, role, full_name from users where role = 'admin'`
  );
  console.log("Admins now:", left.rows);
} finally {
  await client.end();
}
