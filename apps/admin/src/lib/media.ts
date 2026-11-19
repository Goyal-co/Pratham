import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { del, put } from "@vercel/blob";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 4 * 1024 * 1024; // 4MB
const KIND_PREFIX = "menu";

export type MediaDriver = "blob" | "s3" | "local";

export type StoredImage = {
  url: string;
  filename: string;
  contentType: string;
  byteSize: number;
  driver: MediaDriver;
  key: string;
};

function env(name: string) {
  const raw = process.env[name];
  if (raw == null) return "";
  return raw.trim().replace(/^["']|["']$/g, "");
}

export function assertImageFile(file: File) {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Only JPEG, PNG, WebP, or GIF images are allowed");
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error("Image must be under 4MB");
  }
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "image";
}

/** Normalized S3 key prefix from S3_PREFIX (e.g. Ahariva). */
function s3KeyPrefix() {
  return env("S3_PREFIX").replace(/^\/+|\/+$/g, "");
}

function objectKey(filename: string) {
  const prefix = s3KeyPrefix();
  const base = `${KIND_PREFIX}/${filename}`;
  return prefix ? `${prefix}/${base}` : base;
}

function hasBlob() {
  return Boolean(env("BLOB_READ_WRITE_TOKEN"));
}

function hasS3() {
  return Boolean(
    env("S3_BUCKET") &&
      env("S3_REGION") &&
      env("S3_ACCESS_KEY_ID") &&
      env("S3_SECRET_ACCESS_KEY")
  );
}

/** Resolve active driver: MEDIA_DRIVER override, else S3 → Blob → local. */
export function resolveMediaDriver(): MediaDriver {
  const forced = (env("MEDIA_DRIVER") || "auto").toLowerCase();
  if (forced === "blob" || forced === "s3" || forced === "local") {
    if (forced === "blob" && !hasBlob()) {
      throw new Error("MEDIA_DRIVER=blob but BLOB_READ_WRITE_TOKEN is missing");
    }
    if (forced === "s3" && !hasS3()) {
      throw new Error(
        "MEDIA_DRIVER=s3 but S3_REGION / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are incomplete"
      );
    }
    return forced;
  }
  if (hasS3()) return "s3";
  if (hasBlob()) return "blob";
  return "local";
}

export function getS3ClientConfig() {
  if (!hasS3()) {
    throw new Error("S3 is not configured");
  }
  const bucket = env("S3_BUCKET");
  const region = env("S3_REGION") || "ap-south-1";
  const accessKeyId = env("S3_ACCESS_KEY_ID");
  const secretAccessKey = env("S3_SECRET_ACCESS_KEY");
  const endpoint =
    env("S3_ENDPOINT") || env("AWS_ENDPOINT_URL") || undefined;
  const forcePathStyle =
    env("S3_FORCE_PATH_STYLE") === "1" ||
    env("S3_FORCE_PATH_STYLE") === "true" ||
    Boolean(endpoint);
  const publicBase = env("S3_PUBLIC_URL").replace(/\/$/, "") || undefined;

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket, region, endpoint, forcePathStyle, publicBase };
}

/** True when key is under configured S3_PREFIX/menu (path traversal safe). */
export function isAllowedS3MediaKey(key: string) {
  if (!key || key.includes("..") || key.startsWith("/")) return false;
  const prefix = s3KeyPrefix();
  const allowedRoot = prefix ? `${prefix}/${KIND_PREFIX}/` : `${KIND_PREFIX}/`;
  return key.startsWith(allowedRoot);
}

/**
 * Prefer S3_PUBLIC_URL (CDN / MinIO public) when set; else same-origin proxy.
 */
function publicS3Url(key: string): string {
  const { publicBase, bucket, region, endpoint, forcePathStyle } =
    getS3ClientConfig();
  if (publicBase) return `${publicBase}/${key}`;
  if (endpoint) {
    const base = endpoint.replace(/\/$/, "");
    return forcePathStyle
      ? `${base}/${bucket}/${key}`
      : `${base.replace("://", `://${bucket}.`)}/${key}`;
  }
  if (env("S3_PROXY") === "0" || env("S3_PROXY") === "false") {
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }
  return `/api/media/file/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

async function putLocal(
  filename: string,
  buffer: Buffer,
  contentType: string,
  byteSize: number
): Promise<StoredImage> {
  const key = `${KIND_PREFIX}/${filename}`;
  const dir = path.join(process.cwd(), "public", "uploads", KIND_PREFIX);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return {
    url: `/uploads/${key}`,
    filename,
    contentType,
    byteSize,
    driver: "local",
    key,
  };
}

async function putBlob(
  filename: string,
  buffer: Buffer,
  contentType: string,
  byteSize: number
): Promise<StoredImage> {
  const key = `${KIND_PREFIX}/${filename}`;
  const blob = await put(key, buffer, {
    access: "public",
    contentType,
    token: env("BLOB_READ_WRITE_TOKEN"),
  });
  return {
    url: blob.url,
    filename,
    contentType,
    byteSize,
    driver: "blob",
    key,
  };
}

async function putS3(
  filename: string,
  buffer: Buffer,
  contentType: string,
  byteSize: number
): Promise<StoredImage> {
  const { client, bucket } = getS3ClientConfig();
  const key = objectKey(filename);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return {
    url: publicS3Url(key),
    filename,
    contentType,
    byteSize,
    driver: "s3",
    key,
  };
}

/** Upload to S3, Blob, or local public/uploads based on env. */
export async function storeMenuImage(file: File): Promise<StoredImage> {
  assertImageFile(file);
  const filename = `${Date.now()}-${safeName(file.name)}`;
  const contentType = file.type;
  const byteSize = file.size;
  const buffer = Buffer.from(await file.arrayBuffer());
  const driver = resolveMediaDriver();

  if (driver === "s3") return putS3(filename, buffer, contentType, byteSize);
  if (driver === "blob") return putBlob(filename, buffer, contentType, byteSize);
  return putLocal(filename, buffer, contentType, byteSize);
}

function driverFromUrl(url: string): MediaDriver {
  if (url.startsWith("/uploads/")) return "local";
  if (url.startsWith("/api/media/file/")) return "s3";
  if (
    url.includes("blob.vercel-storage.com") ||
    url.includes("vercel-storage.com")
  ) {
    return "blob";
  }
  return "s3";
}

function keyFromUrlOrFilename(url: string, filename: string): string {
  try {
    if (url.startsWith("/uploads/")) {
      return url.replace(/^\/uploads\//, "");
    }
    if (url.startsWith("/api/media/file/")) {
      return url
        .replace(/^\/api\/media\/file\//, "")
        .split("/")
        .map((p) => decodeURIComponent(p))
        .join("/");
    }
    const u = new URL(url, "http://localhost");
    const parts = u.pathname.replace(/^\/+/, "").split("/").map(decodeURIComponent);
    const fileIdx = parts.indexOf("file");
    if (parts[0] === "api" && parts[1] === "media" && fileIdx === 2) {
      return parts.slice(3).join("/");
    }
    const prefix = s3KeyPrefix();
    if (prefix && parts[0] === prefix) {
      return parts.join("/");
    }
    const idx = parts.findIndex((p) => p === KIND_PREFIX);
    if (idx >= 0) return parts.slice(idx).join("/");
    if (parts[0] === env("S3_BUCKET") && parts.length > 1) {
      return parts.slice(1).join("/");
    }
    return parts.join("/");
  } catch {
    /* fall through */
  }
  return objectKey(filename);
}

/** Best-effort delete from whichever store the URL lives in. */
export async function deleteStoredImage(url: string, filename: string) {
  const driver = driverFromUrl(url);
  const key = keyFromUrlOrFilename(url, filename);

  if (driver === "local") {
    const filePath = path.join(process.cwd(), "public", "uploads", key);
    try {
      await unlink(filePath);
    } catch {
      /* already gone */
    }
    return;
  }

  if (driver === "blob") {
    if (!hasBlob()) return;
    try {
      await del(url, { token: env("BLOB_READ_WRITE_TOKEN") });
    } catch {
      /* ignore remote delete failures */
    }
    return;
  }

  if (!hasS3()) return;
  try {
    const { client, bucket } = getS3ClientConfig();
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
  } catch {
    /* ignore remote delete failures */
  }
}
