#!/usr/bin/env bun
/**
 * Fast build script using Bun's native bundler
 */

import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = import.meta.dir;
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

async function clean() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
}

async function build() {
  const result = await Bun.build({
    entrypoints: [join(SRC, "cli.tsx")],
    outdir: DIST,
    target: "node",
    format: "esm",
    sourcemap: "external",
    packages: "external",
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }
}

async function main() {
  const start = performance.now();

  await clean();
  await build();

  const elapsed = (performance.now() - start).toFixed(0);
  console.log(`✓ @mage-knight/mage-dev built in ${elapsed}ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
