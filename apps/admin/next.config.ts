import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@pratham/shared", "@pratham/db"],
  serverExternalPackages: ["pg", "bcryptjs"],
  // Monorepo file tracing for Vercel
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
