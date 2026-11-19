/** Client-safe media URL helpers (no Node/AWS imports). */

const KIND_PREFIX = "menu";

function proxyMediaUrl(key: string): string {
  return `/api/media/file/${key
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

/** Extract object key from a stored media URL (proxy, CDN, or path-style). */
export function mediaKeyFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    if (url.startsWith("/api/media/file/")) {
      return url
        .replace(/^\/api\/media\/file\//, "")
        .split("/")
        .map((p) => decodeURIComponent(p))
        .join("/");
    }
    if (url.startsWith("/uploads/")) {
      return url.replace(/^\/uploads\//, "");
    }
    const u = new URL(url, "http://localhost");
    const parts = u.pathname
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
    if (parts[0] === "api" && parts[1] === "media" && parts[2] === "file") {
      return parts.slice(3).join("/");
    }
    // path-style: /bucket/prefix/menu/file
    if (parts.length >= 2 && parts[1] === "Ahariva") {
      return parts.slice(1).join("/");
    }
    if (parts[0] === "Ahariva" || parts[0] === KIND_PREFIX) {
      return parts.join("/");
    }
    const idx = parts.findIndex((p) => p === KIND_PREFIX || p === "Ahariva");
    if (idx >= 0) return parts.slice(idx).join("/");
    return parts.join("/") || null;
  } catch {
    return null;
  }
}

/**
 * Normalize any stored media URL to a browser-reachable same-origin proxy URL
 * when the asset looks like S3/MinIO/CDN media.
 */
export function resolvePublicMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/uploads/")) return url;
  if (url.startsWith("/api/media/file/")) return url;
  if (
    url.includes("blob.vercel-storage.com") ||
    url.includes("vercel-storage.com")
  ) {
    return url;
  }
  const key = mediaKeyFromUrl(url);
  if (
    key &&
    (key.includes(`${KIND_PREFIX}/`) ||
      key.startsWith("Ahariva/") ||
      url.includes("assets.ahariva") ||
      url.includes("minio") ||
      url.includes("amazonaws.com") ||
      url.includes("S3_PUBLIC") ||
      /^https?:\/\//i.test(url))
  ) {
    // Only rewrite absolute remote URLs / known media keys — leave relative app paths alone
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      key.includes(`${KIND_PREFIX}/`) ||
      key.startsWith("Ahariva/")
    ) {
      return proxyMediaUrl(key);
    }
  }
  return url;
}
