import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { del, put } from "@vercel/blob";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  type ObjectCannedACL,
} from "@aws-sdk/client-s3";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 4 * 1024 * 1024; // 4MB
const KEY_PREFIX = "menu";

export type MediaDriver = "blob" | "s3" | "local";

export type StoredImage = {
  url: string;
  filename: string;
  contentType: string;
  byteSize: number;
  driver: MediaDriver;
  key: string;
};

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

function objectKey(filename: string) {
  return `${KEY_PREFIX}/${filename}`;
}

function hasBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function hasS3() {
  const bucket = process.env.S3_BUCKET?.trim();
  const access =
    process.env.S3_ACCESS_KEY_ID?.trim() ||
    process.env.AWS_ACCESS_KEY_ID?.trim();
  const secret =
    process.env.S3_SECRET_ACCESS_KEY?.trim() ||
    process.env.AWS_SECRET_ACCESS_KEY?.trim();
  return Boolean(bucket && access && secret);
}

/** Resolve active driver: MEDIA_DRIVER override, else Blob → S3 → local. */
export function resolveMediaDriver(): MediaDriver {
  const forced = (process.env.MEDIA_DRIVER || "auto").trim().toLowerCase();
  if (forced === "blob" || forced === "s3" || forced === "local") {
    if (forced === "blob" && !hasBlob()) {
      throw new Error("MEDIA_DRIVER=blob but BLOB_READ_WRITE_TOKEN is missing");
    }
    if (forced === "s3" && !hasS3()) {
      throw new Error(
        "MEDIA_DRIVER=s3 but S3_BUCKET / access keys are incomplete"
      );
    }
    return forced;
  }
  if (hasBlob()) return "blob";
  if (hasS3()) return "s3";
  return "local";
}

function s3Config() {
  const bucket = process.env.S3_BUCKET!.trim();
  const region =
    process.env.S3_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "ap-south-1";
  const accessKeyId = (
    process.env.S3_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    ""
  ).trim();
  const secretAccessKey = (
    process.env.S3_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    ""
  ).trim();
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  const forcePathStyle =
    process.env.S3_FORCE_PATH_STYLE === "1" ||
    process.env.S3_FORCE_PATH_STYLE === "true" ||
    Boolean(endpoint);
  const publicBase = process.env.S3_PUBLIC_URL?.trim().replace(/\/$/, "");

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket, region, endpoint, forcePathStyle, publicBase };
}

function publicS3Url(key: string): string {
  const { bucket, region, endpoint, forcePathStyle, publicBase } = s3Config();
  if (publicBase) return `${publicBase}/${key}`;
  if (endpoint) {
    const base = endpoint.replace(/\/$/, "");
    return forcePathStyle
      ? `${base}/${bucket}/${key}`
      : `${base.replace("://", `://${bucket}.`)}/${key}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function putLocal(
  filename: string,
  buffer: Buffer,
  contentType: string,
  byteSize: number
): Promise<StoredImage> {
  const key = objectKey(filename);
  const dir = path.join(process.cwd(), "public", "uploads", KEY_PREFIX);
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
  const key = objectKey(filename);
  const blob = await put(key, buffer, {
    access: "public",
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
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
  const { client, bucket } = s3Config();
  const key = objectKey(filename);
  const acl = process.env.S3_OBJECT_ACL?.trim() as ObjectCannedACL | undefined;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Only set when your bucket still uses ACLs (many modern buckets do not).
      ...(acl ? { ACL: acl } : {}),
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

/** Upload to Blob, S3, or local public/uploads based on env. */
export async function storeMenuImage(file: File): Promise<StoredImage> {
  assertImageFile(file);
  const filename = `${Date.now()}-${safeName(file.name)}`;
  const contentType = file.type;
  const byteSize = file.size;
  const buffer = Buffer.from(await file.arrayBuffer());
  const driver = resolveMediaDriver();

  if (driver === "blob") return putBlob(filename, buffer, contentType, byteSize);
  if (driver === "s3") return putS3(filename, buffer, contentType, byteSize);
  return putLocal(filename, buffer, contentType, byteSize);
}

function driverFromUrl(url: string): MediaDriver {
  if (url.startsWith("/uploads/")) return "local";
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
    const u = new URL(url);
    const parts = u.pathname.replace(/^\/+/, "").split("/");
    // path-style: /bucket/menu/file → drop bucket if first segment
    const idx = parts.findIndex((p) => p === KEY_PREFIX);
    if (idx >= 0) return parts.slice(idx).join("/");
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
      await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      /* ignore remote delete failures */
    }
    return;
  }

  if (!hasS3()) return;
  try {
    const { client, bucket } = s3Config();
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
