#!/usr/bin/env bun
/**
 * Bun fullstack dev server with HMR
 * Alternative to Vite dev server
 *
 * Usage: bun run dev:bun
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

const server = Bun.serve({
  port: 3000,

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

console.log(`
  🚀 Bun dev server running at http://localhost:${server.port}

  Features:
  • Hot Module Replacement (HMR)
  • Browser console logs in terminal
  • Fast TypeScript/JSX transpilation

  Press Ctrl+C to stop
`);
