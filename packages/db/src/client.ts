import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { parseDatabaseUrl } from "./parse-database-url";

let pool: Pool | null = null;

function shouldUseSsl(hint: string) {
  if (process.env.DATABASE_SSL === "true") return true;
  if (process.env.DATABASE_SSL === "false") return false;
  if (process.env.VERCEL === "1") return true;
  if (
    /neon\.tech|supabase\.co|railway\.app|render\.com|amazonaws\.com/i.test(
      hint
    )
  ) {
    return true;
  }
  return false;
}

function resolvePoolConfig() {
  const host = process.env.DATABASE_HOST?.trim() || process.env.PGHOST?.trim();
  const user = process.env.DATABASE_USER?.trim() || process.env.PGUSER?.trim();
  const password =
    process.env.DATABASE_PASSWORD ?? process.env.PGPASSWORD ?? undefined;
  const database =
    process.env.DATABASE_NAME?.trim() || process.env.PGDATABASE?.trim();
  const port = Number(
    process.env.DATABASE_PORT || process.env.PGPORT || 5432
  );

  if (host && user && password != null && database) {
    return {
      config: {
        host,
        port: Number.isFinite(port) ? port : 5432,
        user,
        password,
        database,
      },
      sslHint: host,
    };
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to apps/admin/.env.local or Vercel env vars."
    );
  }

  // Handle passwords with @ / : without requiring URL-encoding in env
  const parsed = parseDatabaseUrl(connectionString);
  if (parsed) {
    return {
      config: {
        host: parsed.host,
        port: parsed.port,
        user: parsed.user,
        password: parsed.password,
        database: parsed.database,
      },
      sslHint: connectionString,
    };
  }

  const cleaned = connectionString
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");
  return {
    connectionString: cleaned,
    sslHint: connectionString,
  };
}

export function getPool() {
  if (!pool) {
    const resolved = resolvePoolConfig();
    const ssl = shouldUseSsl(resolved.sslHint)
      ? { rejectUnauthorized: false }
      : undefined;
    const serverless = process.env.VERCEL === "1";
    pool = new Pool({
      ...(resolved.config
        ? resolved.config
        : { connectionString: resolved.connectionString }),
      ssl,
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
