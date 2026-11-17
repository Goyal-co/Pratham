import { NextRequest } from "next/server";
import { query } from "@pratham/db";
import {
  getUserFromRequest,
  invalidateUserCache,
  type AuthUser,
} from "@/lib/auth";
import { error, json } from "@/lib/api";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return error("Unauthorized", 401);
  return json({ user });
}

/** Student self-update: name, phone, hostel, room. */
export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return error("Unauthorized", 401);
  if (user.role !== "student") return error("Students only", 403);

  const body = await req.json().catch(() => ({}));
  const hasName = Object.prototype.hasOwnProperty.call(body, "full_name");
  const hasPhone = Object.prototype.hasOwnProperty.call(body, "phone");
  const hasHostel = Object.prototype.hasOwnProperty.call(body, "hostel");
  const hasRoom = Object.prototype.hasOwnProperty.call(body, "room");

  if (!hasName && !hasPhone && !hasHostel && !hasRoom) {
    return error("Nothing to update");
  }

  const fullName = hasName ? String(body.full_name ?? "").trim() : null;
  if (hasName && !fullName) return error("Name cannot be empty");

  const phone = hasPhone ? String(body.phone ?? "").trim() || null : null;
  const hostel = hasHostel ? String(body.hostel ?? "").trim() || null : null;
  const room = hasRoom ? String(body.room ?? "").trim() || null : null;

  const { rows } = await query<AuthUser>(
    `update users set
       full_name = case when $2::boolean then $3 else full_name end,
       phone = case when $4::boolean then $5 else phone end,
       hostel = case when $6::boolean then $7 else hostel end,
       room = case when $8::boolean then $9 else room end
     where id = $1
     returning id, email, role, full_name, phone, hostel, room, referral_code`,
    [
      user.id,
      hasName,
      fullName,
      hasPhone,
      phone,
      hasHostel,
      hostel,
      hasRoom,
      room,
    ]
  );

  if (!rows[0]) return error("User not found", 404);
  invalidateUserCache(user.id);
  return json({ user: rows[0] });
}
