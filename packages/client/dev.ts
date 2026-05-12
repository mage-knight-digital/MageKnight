#!/usr/bin/env bun
/**
 * Bun fullstack dev server with HMR
 * Alternative to Vite dev server
 *
 * Port: defaults to 3000. If busy, tries 3001, 3002, … Prefer
 * CLIENT_DEV_PORT (SERVER also honors PORT via mk-server — use CLIENT_DEV_PORT
 * to target only this dev server). From this package: `bun run dev`.
 */

import homepage from "./index.html";
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

// ---------------------------------------------------------------------------
// Artifact serving for the replay viewer
// ---------------------------------------------------------------------------

const REPO_ROOT = join(import.meta.dir, "../..");

/** Directories to scan for artifact .json files. */
const ARTIFACT_DIRS = [
  join(REPO_ROOT, "sim-artifacts"),
  join(REPO_ROOT, "packages/python-sdk/sim-artifacts"),
];

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

async function handleArtifactRequest(url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith("/__artifacts")) return null;

  // Serve a specific file: /__artifacts?dir=1&path=some/file.json
  const dirParam = url.searchParams.get("dir");
  const pathParam = url.searchParams.get("path");
  if (dirParam !== null && pathParam !== null) {
    const dirIndex = parseInt(dirParam, 10);
    const root = ARTIFACT_DIRS[dirIndex];
    if (!root) return new Response("Invalid dir index", { status: 400 });

    const filePath = join(root, decodeURIComponent(pathParam));
    if (!filePath.startsWith(root)) return new Response("Forbidden", { status: 403 });

    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file, {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("Not found", { status: 404 });
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
        return { path: relPath, name: relPath, dir: i, size: s.size, mtime: s.mtime.toISOString() };
      })
    );
    allItems.push(...items);
  }
  allItems.sort((a, b) => b.mtime.localeCompare(a.mtime));
  return Response.json(allItems);
}

// ---------------------------------------------------------------------------
// Dev server
// ---------------------------------------------------------------------------

const DEFAULT_CLIENT_DEV_PORT = 3000;
/** How many ports to try (base, base+1, …) when the preferred port is taken. */
const CLIENT_DEV_PORT_TRIES = 64;

function parseTcpPort(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 && n <= 65535 ? n : undefined;
}

function errnoCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code?: unknown }).code)
    : undefined;
}

/** Prefer CLIENT_DEV_PORT. PORT matches mk-server convention but both read it if set in `.env`. */
const preferredClientDevPort =
  parseTcpPort(process.env["CLIENT_DEV_PORT"]) ??
  parseTcpPort(process.env["PORT"]) ??
  DEFAULT_CLIENT_DEV_PORT;

let server: ReturnType<typeof Bun.serve>;
for (let offset = 0; offset < CLIENT_DEV_PORT_TRIES; offset++) {
  const port = preferredClientDevPort + offset;
  if (port > 65535) break;
  try {
    server = Bun.serve({
      port,

      // Enable HMR and dev features
      development: {
        hmr: true,
        console: true,
      },

      routes: {
        // Serve the app at root
        "/": homepage,
      },

      // Handle API routes and static files
      async fetch(req) {
        const url = new URL(req.url);

        // Artifact API for replay viewer
        const artifactResponse = await handleArtifactRequest(url);
        if (artifactResponse) return artifactResponse;

        // Serve static files from public folder
        if (url.pathname.startsWith("/public/")) {
          const filePath = `./public${url.pathname.slice(7)}`;
          const file = Bun.file(filePath);
          if (await file.exists()) {
            return new Response(file);
          }
        }

        // Serve files directly from public without /public prefix
        const publicFile = Bun.file(`./public${url.pathname}`);
        if (await publicFile.exists()) {
          return new Response(publicFile);
        }

        // 404 for unhandled routes
        return new Response("Not Found", { status: 404 });
      },
    });
    if (offset > 0) {
      console.warn(
        `[client dev] port ${preferredClientDevPort} in use; listening on ${port} (set CLIENT_DEV_PORT to pick a port)`,
      );
    }
    break;
  } catch (err) {
    if (errnoCode(err) === "EADDRINUSE" && offset < CLIENT_DEV_PORT_TRIES - 1) {
      continue;
    }
    throw err;
  }
}

if (typeof server === "undefined") {
  throw new Error(
    `[client dev] no free TCP port in ${preferredClientDevPort}..${Math.min(
      preferredClientDevPort + CLIENT_DEV_PORT_TRIES - 1,
      65535,
    )}; set CLIENT_DEV_PORT`,
  );
}

console.log(`
  🚀 Bun dev server running at http://localhost:${server.port}

  Features:
  • Hot Module Replacement (HMR)
  • Browser console logs in terminal
  • Fast TypeScript/JSX transpilation

  Press Ctrl+C to stop
`);
