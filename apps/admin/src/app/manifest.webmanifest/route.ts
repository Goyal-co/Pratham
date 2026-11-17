import { NextRequest } from "next/server";
import { studentManifestForHost } from "@/lib/student-manifest";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const body = studentManifestForHost(host);
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
