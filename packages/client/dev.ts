#!/usr/bin/env bun
/**
 * Bun fullstack dev server with HMR
 * Alternative to Vite dev server
 *
 * Usage: bun run dev:bun
 */

import homepage from "./index.html";

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
