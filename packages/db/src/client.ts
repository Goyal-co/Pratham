import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | null = null;

function shouldUseSsl(connectionString: string) {
  if (process.env.DATABASE_SSL === "true") return true;
  if (process.env.DATABASE_SSL === "false") return false;
  if (process.env.VERCEL === "1") return true;
  if (
    /neon\.tech|supabase\.co|railway\.app|render\.com|amazonaws\.com/i.test(
      connectionString
    )
  ) {
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
    const cleaned = connectionString
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/\?&/, "?")
      .replace(/[?&]$/, "");
    const serverless = process.env.VERCEL === "1";
    pool = new Pool({
      connectionString: cleaned,
      ssl: shouldUseSsl(connectionString)
        ? { rejectUnauthorized: false }
        : undefined,
      max: serverless ? 4 : 10,
      idleTimeoutMillis: serverless ? 5_000 : 30_000,
      connectionTimeoutMillis: 8_000,
      allowExitOnIdle: serverless,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });
    pool.on("error", (err) => {
      console.error("pg pool error", err.message);
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
