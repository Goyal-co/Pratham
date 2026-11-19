export type ParsedDatabaseUrl = {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
};

/**
 * Parse postgres URLs even when the password contains `@`, `:`, `/`, etc.
 * Example: postgresql://postgres:Mst@2069@core-postgres:5432/pratham
 */
export function parseDatabaseUrl(raw: string): ParsedDatabaseUrl | null {
  const input = String(raw || "").trim();
  if (!input) return null;

  const matched = input.match(
    /^(?:jdbc:)?postgres(?:ql)?:\/\/([^:\/?#]+):(.+)@([^:\/?#]+)(?::(\d+))?\/([^?\/#]+)(?:\?.*)?$/i
  );
  if (!matched) return null;

  const user = decodeURIComponent(matched[1]);
  // Password may be raw (Mst@2069) or already encoded (Mst%402069)
  let password = matched[2];
  try {
    password = decodeURIComponent(password);
  } catch {
    /* keep raw */
  }
  const host = matched[3];
  const port = matched[4] ? Number(matched[4]) : 5432;
  const database = decodeURIComponent(matched[5]);

  if (!user || password == null || !host || !database) return null;

  return {
    user,
    password,
    host,
    port: Number.isFinite(port) ? port : 5432,
    database,
  };
}
