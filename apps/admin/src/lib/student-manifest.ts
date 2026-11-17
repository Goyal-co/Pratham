import { isStudentHost } from "@/lib/hosts";

const ICONS = [
  {
    src: "/icons/icon-192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
  },
  {
    src: "/icons/icon-192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "maskable",
  },
  {
    src: "/icons/icon-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
  },
  {
    src: "/icons/icon-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
] as const;

/**
 * Student PWA manifest.
 * On app.* host, URLs are /, /profile, /menu — scope must be "/".
 * On path install (/app), scope must be "/app/" so /app/profile stays standalone.
 */
export function studentManifestForHost(host: string) {
  const studentHost = isStudentHost(host);
  return {
    id: studentHost ? "/" : "/app/",
    name: "Ahariva",
    short_name: "Ahariva",
    description: "Breakfast, lunch & dinner · cash on delivery",
    start_url: studentHost ? "/" : "/app/",
    scope: studentHost ? "/" : "/app/",
    display: "standalone" as const,
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait" as const,
    background_color: "#F5F2E8",
    theme_color: "#9BB08D",
    icons: [...ICONS],
  };
}
