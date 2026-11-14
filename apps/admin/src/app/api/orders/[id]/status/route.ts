import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { updateOrderStatus } from "@/lib/services";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);
  const { id } = await ctx.params;
  const body = await req.json();
  try {
    const order = await updateOrderStatus(id, body.status, user.id);
    return json({ order });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Update failed");
  }
}
