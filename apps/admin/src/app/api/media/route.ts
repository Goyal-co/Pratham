import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { resolveMediaDriver, storeMenuImage } from "@/lib/media";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);

  const limit = Math.min(
    100,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 60))
  );
  const { rows } = await query(
    `select id, url, filename, content_type, byte_size, created_at
     from media_assets
     order by created_at desc
     limit $1`,
    [limit]
  );
  let driver = "local";
  try {
    driver = resolveMediaDriver();
  } catch {
    /* keep local label if misconfigured */
  }
  return json({ assets: rows, driver });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error("Expected multipart form data");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return error("file required");

  try {
    const stored = await storeMenuImage(file);
    const { rows } = await query(
      `insert into media_assets (url, filename, content_type, byte_size, created_by)
       values ($1,$2,$3,$4,$5)
       returning id, url, filename, content_type, byte_size, created_at`,
      [
        stored.url,
        stored.filename,
        stored.contentType,
        stored.byteSize,
        user.id,
      ]
    );
    return json({ asset: rows[0] });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Upload failed");
  }
}
