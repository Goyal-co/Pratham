import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Serve Ahariva logo icons; keeps older /icons/192 and /icons/512 URLs working. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ size: string }> }
) {
  const { size: raw } = await ctx.params;
  const n = Number(String(raw).replace(/\D/g, "")) || 192;
  const file = n >= 400 ? "icon-512.png" : "icon-192.png";
  const filePath = path.join(process.cwd(), "public", "icons", file);
  try {
    const buf = await readFile(filePath);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("Icon not found", { status: 404 });
  }
}
