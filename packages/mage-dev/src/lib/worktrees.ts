import { execSync, spawn } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { REPO_ROOT, WORKTREE_BASE, getWorktreePath } from "./config.js";

export interface Worktree {
  name: string;
  path: string;
  branch: string;
  isMain: boolean;
  serverRunning: boolean;
  serverUrl: string | undefined;
}

function cleanupStaleWorktrees(): void {
  // Prune git's worktree references
  try {
    execSync("git worktree prune", { cwd: REPO_ROOT, stdio: "pipe" });
  } catch {
    // Ignore errors
  }

  // Remove directories that aren't valid worktrees (no .git file)
  if (existsSync(WORKTREE_BASE)) {
    const dirs = readdirSync(WORKTREE_BASE, { withFileTypes: true });
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const worktreePath = `${WORKTREE_BASE}/${dir.name}`;
        if (!existsSync(`${worktreePath}/.git`)) {
          rmSync(worktreePath, { recursive: true, force: true });
        }
      }
    }
  }
}

function getBranchName(worktreePath: string): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: worktreePath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function isServerRunning(name: string): boolean {
  const path = getWorktreePath(name);
  const pidFile = `${path}/.dev-server.pid`;

  if (!existsSync(pidFile)) {
    return false;
  }

  try {
    const pid = readFileSync(pidFile, "utf-8").trim();
    // Check if process exists
    process.kill(parseInt(pid, 10), 0);
    return true;
  } catch {
    return false;
  }
}

function getServerUrl(name: string): string | undefined {
  const path = getWorktreePath(name);
  const logFile = `${path}/.dev-server.log`;

  if (!existsSync(logFile)) {
    return undefined;
  }

  try {
    const content = readFileSync(logFile, "utf-8");
    const match = content.match(/Local:\s*(http[^\s]+)/);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

export function getWorktrees(): Worktree[] {
  cleanupStaleWorktrees();

  const worktrees: Worktree[] = [];

  // Always include main repo
  worktrees.push({
    name: "main",
    path: REPO_ROOT,
    branch: getBranchName(REPO_ROOT),
    isMain: true,
    serverRunning: isServerRunning("main"),
    serverUrl: getServerUrl("main"),
  });

  // Add worktrees from base directory
  if (existsSync(WORKTREE_BASE)) {
    const dirs = readdirSync(WORKTREE_BASE, { withFileTypes: true });
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const name = dir.name;
        const worktreePath = `${WORKTREE_BASE}/${name}`;

        if (existsSync(`${worktreePath}/.git`)) {
          worktrees.push({
            name,
            path: worktreePath,
            branch: getBranchName(worktreePath),
            isMain: false,
            serverRunning: isServerRunning(name),
            serverUrl: getServerUrl(name),
          });
        }
      }
    }
  }

  return worktrees;
}

export function copyToClipboard(text: string): boolean {
  try {
    execSync(`echo ${JSON.stringify(text)} | pbcopy`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function createWorktree(
  branchName: string,
  onOutput: (line: string) => void
): Promise<{ success: boolean; error?: string; worktreePath?: string }> {
  return new Promise((resolve) => {
    const dirName = branchName.replace(/\//g, "-");
    const worktreePath = `${WORKTREE_BASE}/${dirName}`;

    if (existsSync(worktreePath)) {
      resolve({ success: false, error: "Worktree already exists" });
      return;
    }

    onOutput(`Creating worktree: ${branchName}`);

    try {
      // Create the worktree
      execSync(`git worktree add -b "${branchName}" "${worktreePath}"`, {
        cwd: REPO_ROOT,
        stdio: "pipe",
      });
      onOutput("Worktree created, running bun install...");

      // Run bun install && bun build
      const child = spawn("bun", ["install"], {
        cwd: worktreePath,
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout?.on("data", (data: Buffer) => {
        onOutput(data.toString().trim());
      });

      child.stderr?.on("data", (data: Buffer) => {
        onOutput(data.toString().trim());
      });

      child.on("close", (code) => {
        if (code !== 0) {
          resolve({ success: false, error: "bun install failed" });
          return;
        }

        onOutput("Running bun build...");

        const buildChild = spawn("bun", ["run", "build"], {
          cwd: worktreePath,
          stdio: ["ignore", "pipe", "pipe"],
        });

        buildChild.stdout?.on("data", (data: Buffer) => {
          onOutput(data.toString().trim());
        });

        buildChild.stderr?.on("data", (data: Buffer) => {
          onOutput(data.toString().trim());
        });

        buildChild.on("close", (buildCode) => {
          if (buildCode !== 0) {
            resolve({ success: false, error: "bun build failed" });
            return;
          }
          onOutput("Done!");
          resolve({ success: true, worktreePath });
        });
      });
    } catch (e) {
      resolve({
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  });
}

export function deleteWorktree(
  name: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (name === "main") {
      resolve({ success: false, error: "Cannot delete main repo" });
      return;
    }

    const worktreePath = getWorktreePath(name);
    if (!existsSync(worktreePath)) {
      resolve({ success: false, error: "Worktree not found" });
      return;
    }

    const branchName = getBranchName(worktreePath);

    // Kill dev server if running
    killDevServer(name);

    // Remove worktree asynchronously
    const removeChild = spawn(
      "git",
      ["worktree", "remove", worktreePath, "--force"],
      {
        cwd: REPO_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    removeChild.on("close", (code) => {
      if (code !== 0) {
        resolve({ success: false, error: "Failed to remove worktree" });
        return;
      }

      // Delete branch asynchronously
      const branchChild = spawn("git", ["branch", "-D", branchName], {
        cwd: REPO_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      });

      branchChild.on("close", () => {
        // Branch deletion can fail if already deleted, we don't care
        resolve({ success: true });
      });
    });
  });
}

export function startDevServer(
  name: string
): { success: boolean; error?: string; alreadyRunning?: boolean } {
  const path = getWorktreePath(name);
  const logFile = `${path}/.dev-server.log`;
  const pidFile = `${path}/.dev-server.pid`;

  // Check if already running
  if (isServerRunning(name)) {
    return { success: true, alreadyRunning: true };
  }

  try {
    // Start in background
    const child = spawn("bun", ["run", "dev:client"], {
      cwd: path,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Write PID
    writeFileSync(pidFile, String(child.pid));

    // Redirect output to log file
    const logStream = createWriteStream(logFile);
    child.stdout?.pipe(logStream);
    child.stderr?.pipe(logStream);

    child.unref();

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export function killDevServer(name: string): boolean {
  const path = getWorktreePath(name);
  const pidFile = `${path}/.dev-server.pid`;

  if (!existsSync(pidFile)) {
    return false;
  }

  try {
    const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);

    // Kill the process and its children
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process may already be dead
    }

    // Also try to kill child processes
    try {
      execSync(`pkill -P ${pid}`, { stdio: "pipe" });
    } catch {
      // Ignore
    }

    rmSync(pidFile, { force: true });
    return true;
  } catch {
    return false;
  }
}

export function openInBrowser(url: string): void {
  const { platform } = process;
  const command =
    platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";

  try {
    execSync(`${command} "${url}"`, { stdio: "pipe" });
  } catch {
    // Ignore errors
  }
}
