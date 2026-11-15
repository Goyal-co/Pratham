/**
 * Vercel looks for `.next` at the project Root Directory.
 * When Root Directory is the monorepo root, Next builds into apps/admin/.next —
 * copy it to ./.next so the deploy step finds the routes manifest.
 * When Root Directory is already apps/admin, .next is already in place — no-op.
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const adminNext = join("apps", "admin", ".next");
const rootNext = ".next";
const rootBuildId = join(rootNext, "BUILD_ID");
const adminBuildId = join(adminNext, "BUILD_ID");

if (existsSync(rootBuildId)) {
  console.log("vercel-postbuild: .next already present at project root — ok");
  process.exit(0);
}

if (!existsSync(adminBuildId)) {
  console.error(
    "vercel-postbuild: missing apps/admin/.next/BUILD_ID — admin build failed?"
  );
  process.exit(1);
}

rmSync(rootNext, { recursive: true, force: true });
cpSync(adminNext, rootNext, { recursive: true });
console.log("vercel-postbuild: copied apps/admin/.next → ./.next");
