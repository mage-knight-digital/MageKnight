import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../../..");
const bundleCheckScript = join(repoRoot, "scripts/check-client-production-bundle.sh");
let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

describe("production bundle check", () => {
  it("rejects React development-mode references", async () => {
    const bundleDir = await mkdtemp(join(tmpdir(), "mk-client-bundle-"));
    tempDirs.push(bundleDir);

    await writeFile(
      join(bundleDir, "chunk.js"),
      [
        "const api = 'wss://api.mageknightdigital.app/ws';",
        "console.info('Download the React DevTools for a better development experience');",
      ].join("\n")
    );

    const result = Bun.spawnSync(["bash", bundleCheckScript, bundleDir], {
      cwd: repoRoot,
      stderr: "pipe",
      stdout: "pipe",
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("React development-mode references");
  });
});
