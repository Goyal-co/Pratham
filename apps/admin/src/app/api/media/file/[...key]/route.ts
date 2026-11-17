import { GetObjectCommand } from "@aws-sdk/client-s3";
import { error } from "@/lib/api";
import { getS3ClientConfig, isAllowedS3MediaKey } from "@/lib/media";

export const runtime = "nodejs";

/** Public image proxy for private S3 objects (prefix-scoped). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string[] }> }
) {
  const { key: parts } = await ctx.params;
  const key = (parts || []).map(decodeURIComponent).join("/");
  if (!key || key.includes("..") || !isAllowedS3MediaKey(key)) {
    return error("Not found", 404);
  }

  let config: ReturnType<typeof getS3ClientConfig>;
  try {
    config = getS3ClientConfig();
  } catch {
    return error("Media storage not configured", 503);
  }

  try {
    const out = await config.client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key })
    );
    if (!out.Body) return error("Not found", 404);

    const bytes = await out.Body.transformToByteArray();
    const contentType = out.ContentType || "application/octet-stream";
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        ...(out.ETag ? { ETag: out.ETag } : {}),
      },
    });
  } catch {
    return error("Not found", 404);
  }
}
