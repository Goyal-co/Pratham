import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | null = null;

function shouldUseSsl(connectionString: string) {
  if (process.env.DATABASE_SSL === "true") return true;
  if (process.env.DATABASE_SSL === "false") return false;
  // Hosted Postgres on Vercel / Neon / Railway typically needs SSL
  if (process.env.VERCEL === "1") return true;
  if (/neon\.tech|supabase\.co|railway\.app|render\.com|amazonaws\.com/i.test(connectionString)) {
    return true;
  }
  return false;
}

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add it to apps/admin/.env.local or Vercel env vars."
      );
    }
    // Avoid pg treating sslmode=require as verify-full (fails on RDS CA chains)
    const cleaned = connectionString
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/\?&/, "?")
      .replace(/[?&]$/, "");
    pool = new Pool({
      connectionString: cleaned,
      ssl: shouldUseSsl(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
      max: process.env.VERCEL === "1" ? 3 : 10,
      idleTimeoutMillis: process.env.VERCEL === "1" ? 10_000 : 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
