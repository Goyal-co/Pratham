import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return error("Unauthorized", 401);
  return json({ user });
}
