import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { generateFixedPlanOrders } from "@/lib/services";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "admin") return error("Admin only", 403);
  const body = await req.json().catch(() => ({}));
  const created = await generateFixedPlanOrders(body.date);
  return json({ created });
}
