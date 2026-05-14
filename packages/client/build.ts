#!/usr/bin/env bun
/**
 * Fast production build using Bun's native bundler
 * Alternative to Vite's Rollup-based build
 */

import { rm, mkdir, cp, readdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = import.meta.dir;
const DIST = join(ROOT, "dist");
const PUBLIC = join(ROOT, "public");
const mkBundleAssets = process.env["MK_BUNDLE_ASSETS"];
const BUNDLE_ASSETS = mkBundleAssets === "1" || mkBundleAssets === "true";
const ASSETS_BASE_URL = process.env["VITE_ASSETS_BASE_URL"];

async function clean() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
}

async function copyPublicAssets() {
  // Copy public folder contents to dist. The large gitignored asset pack is
  // CDN-hosted by default; bundle it only for explicit offline/local builds.
  try {
    const entries = (await readdir(PUBLIC)).filter((entry) => BUNDLE_ASSETS || entry !== "assets");
    await Promise.all(
      entries.map((entry) =>
        cp(join(PUBLIC, entry), join(DIST, entry), { recursive: true })
      )
    );
  } catch {
    // public folder may not exist or be empty
  }
}

async function build() {
  const result = await Bun.build({
    entrypoints: [join(ROOT, "index.html")],
    outdir: DIST,
    target: "browser",
    format: "esm",
    minify: true,
    sourcemap: "external",
    splitting: true,
    define: {
      "import.meta.env": JSON.stringify({
        DEV: false,
        PROD: true,
        VITE_ASSETS_BASE_URL: ASSETS_BASE_URL,
      }),
    },
    // External packages that should not be bundled
    // (none for browser - bundle everything)
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  return result;
}

async function main() {
  const start = performance.now();

  await clean();
  await Promise.all([build(), copyPublicAssets()]);

  const elapsed = (performance.now() - start).toFixed(0);
  console.log(`✓ @mage-knight/client built in ${elapsed}ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
