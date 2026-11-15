import { NextRequest } from "next/server";
import { getZonedParts } from "@pratham/shared";
import { getUserFromRequest } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { getStudentHistory } from "@/lib/history";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== "student") return error("Students only", 403);

  const { dateStr } = getZonedParts();
  const month =
    req.nextUrl.searchParams.get("month") || dateStr.slice(0, 7);
  const meal = req.nextUrl.searchParams.get("meal");
  const status = req.nextUrl.searchParams.get("status");
  const source = req.nextUrl.searchParams.get("source");
  const date = req.nextUrl.searchParams.get("date");
  const entryType = req.nextUrl.searchParams.get("entry_type");

  if (!/^\d{4}-\d{2}$/.test(month)) return error("month must be YYYY-MM");

  const history = await getStudentHistory({
    studentId: user.id,
    month,
    meal,
    status,
    source,
    date,
    entryType,
  });

  return json(history);
}
