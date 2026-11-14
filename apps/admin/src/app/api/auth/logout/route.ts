import { COOKIE } from "@/lib/auth";
import { json } from "@/lib/api";

export async function POST() {
  const res = json({ ok: true });
  res.cookies.set({
    name: COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
