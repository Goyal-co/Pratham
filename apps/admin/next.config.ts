import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@pratham/shared", "@pratham/db"],
  serverExternalPackages: ["pg", "bcryptjs"],
  // Monorepo file tracing for Vercel
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async headers() {
    return [
      {
        // Default max scope for /app/sw.js is only /app/ (trailing slash).
        // Allow /app so registration scope "/app" works in local + prod.
        source: "/app/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/app" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/admin-sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
