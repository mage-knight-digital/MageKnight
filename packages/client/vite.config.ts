import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../..");

/**
 * Directories to scan for artifact .json files (relative to repo root).
 * The CLI `--save-artifact` writes to `./sim-artifacts` relative to cwd,
 * which is typically `packages/python-sdk/` when running from that package.
 */
const ARTIFACT_DIRS = [
  join(REPO_ROOT, "sim-artifacts"),
  join(REPO_ROOT, "packages/python-sdk/sim-artifacts"),
];

/**
 * Vite plugin that serves sim-artifacts for the replay viewer.
 *
 * - GET /__artifacts  → JSON list of { path, name, dir, size, mtime }
 * - GET /__artifacts?dir=<dirIndex>&path=<relPath> → raw artifact file
 */
function artifactServerPlugin(): Plugin {
  const ROUTE_PREFIX = "/__artifacts";

  async function walkJson(dir: string): Promise<string[]> {
    const results: string[] = [];
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await walkJson(full)));
      } else if (entry.name.endsWith(".json")) {
        results.push(full);
      }
    }
    return results;
  }

  return {
    name: "artifact-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(ROUTE_PREFIX)) return next();

        const url = new URL(req.url, "http://localhost");

        // Serve a specific file: /__artifacts?dir=1&path=some/file.json
        const dirParam = url.searchParams.get("dir");
        const pathParam = url.searchParams.get("path");
        if (dirParam !== null && pathParam !== null) {
          const dirIndex = parseInt(dirParam, 10);
          const root = ARTIFACT_DIRS[dirIndex];
          if (!root) {
            res.statusCode = 400;
            res.end("Invalid dir index");
            return;
          }
          const filePath = join(root, decodeURIComponent(pathParam));
          // Prevent path traversal
          if (!filePath.startsWith(root)) {
            res.statusCode = 403;
            res.end("Forbidden");
            return;
          }
          try {
            const content = await readFile(filePath);
            res.setHeader("Content-Type", "application/json");
            res.end(content);
          } catch {
            res.statusCode = 404;
            res.end("Not found");
          }
          return;
        }

        // Index endpoint: /__artifacts
        const allItems: { path: string; name: string; dir: number; size: number; mtime: string }[] = [];
        for (let i = 0; i < ARTIFACT_DIRS.length; i++) {
          const root = ARTIFACT_DIRS[i];
          const files = await walkJson(root);
          const items = await Promise.all(
            files.map(async (f) => {
              const s = await stat(f);
              const relPath = relative(root, f);
              return {
                path: relPath,
                name: relPath,
                dir: i,
                size: s.size,
                mtime: s.mtime.toISOString(),
              };
            })
          );
          allItems.push(...items);
        }
        // Sort newest first
        allItems.sort((a, b) => b.mtime.localeCompare(a.mtime));
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(allItems));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), artifactServerPlugin()],
  server: {
    port: 3000,
  },
});
