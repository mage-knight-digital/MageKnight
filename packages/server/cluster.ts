#!/usr/bin/env bun

/**
 * Cluster mode launcher for Mage Knight server.
 *
 * Starts multiple server instances on sequential ports to utilize multiple CPU cores.
 * Each server process is independent and can fully utilize one CPU core.
 *
 * Usage:
 *   bun packages/server/cluster.ts --workers 8
 *   bun packages/server/cluster.ts --workers 4 --base-port 3001
 */

import { spawn, type ChildProcess } from "child_process";
import { resolve } from "path";

const DEFAULT_BASE_PORT = 3001;
const DEFAULT_WORKERS = 8;

interface ClusterOptions {
  workers: number;
  basePort: number;
}

function parseArgs(): ClusterOptions {
  const args = process.argv.slice(2);
  let workers = DEFAULT_WORKERS;
  let basePort = DEFAULT_BASE_PORT;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--workers" && i + 1 < args.length) {
      workers = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--base-port" && i + 1 < args.length) {
      basePort = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log("Usage: bun cluster.ts [options]");
      console.log("Options:");
      console.log("  --workers N       Number of server instances to start (default: 8)");
      console.log("  --base-port N     Starting port number (default: 3001)");
      console.log("  --help, -h        Show this help message");
      process.exit(0);
    }
  }

  if (isNaN(workers) || workers < 1) {
    console.error("Error: --workers must be a positive integer");
    process.exit(1);
  }

  if (isNaN(basePort) || basePort < 1024 || basePort > 65535) {
    console.error("Error: --base-port must be between 1024 and 65535");
    process.exit(1);
  }

  return { workers, basePort };
}

function startCluster(options: ClusterOptions): void {
  const { workers, basePort } = options;
  const serverScript = resolve(__dirname, "dev.ts");
  const processes: ChildProcess[] = [];

  console.log("=== Mage Knight Server Cluster ===");
  console.log(`Starting ${workers} server instances...`);
  console.log(`Ports: ${basePort} - ${basePort + workers - 1}`);
  console.log("");

  // Start worker processes
  for (let i = 0; i < workers; i++) {
    const port = basePort + i;
    const env = {
      ...process.env,
      PORT: port.toString(),
      HOST: "0.0.0.0",
    };

    const child = spawn("bun", [serverScript], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data) => {
      const lines = data.toString().trim().split("\n");
      for (const line of lines) {
        console.log(`[Worker ${i + 1}:${port}] ${line}`);
      }
    });

    child.stderr?.on("data", (data) => {
      const lines = data.toString().trim().split("\n");
      for (const line of lines) {
        console.error(`[Worker ${i + 1}:${port}] ERROR: ${line}`);
      }
    });

    child.on("exit", (code, signal) => {
      if (code !== null && code !== 0) {
        console.error(`[Worker ${i + 1}:${port}] Exited with code ${code}`);
      } else if (signal) {
        console.log(`[Worker ${i + 1}:${port}] Killed by signal ${signal}`);
      }

      // If any worker dies, shut down all workers
      if (code !== 0 && signal !== "SIGTERM" && signal !== "SIGINT") {
        console.error("Worker died unexpectedly, shutting down cluster...");
        shutdown();
      }
    });

    processes.push(child);
  }

  console.log("");
  console.log("✓ All workers started successfully!");
  console.log("");
  console.log("Server URLs for Python SDK:");
  console.log(`  ws://127.0.0.1:${basePort}  (and ${workers - 1} more on sequential ports)`);
  console.log("");
  console.log("Press Ctrl+C to stop all servers");

  // Graceful shutdown handler
  const shutdown = (): void => {
    console.log("\nShutting down cluster...");
    for (const child of processes) {
      child.kill("SIGTERM");
    }
    setTimeout(() => {
      console.log("Cluster stopped.");
      process.exit(0);
    }, 1000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Main
const options = parseArgs();
startCluster(options);
