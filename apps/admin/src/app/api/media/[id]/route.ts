import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { deleteStoredImage } from "@/lib/media";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);

  const { id } = await ctx.params;
  if (!id) return error("id required");

  const existing = await query<{ url: string; filename: string }>(
    `select url, filename from media_assets where id = $1`,
    [id]
  );
  const row = existing.rows[0];
  if (!row) return error("Asset not found", 404);

  await deleteStoredImage(row.url, row.filename);

  const { rowCount } = await query(`delete from media_assets where id = $1`, [
    id,
  ]);
  if (!rowCount) return error("Asset not found", 404);
  return json({ deleted: true });
}
