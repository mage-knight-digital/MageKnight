import { execSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { basename, dirname } from "node:path";
import { homedir } from "node:os";

function findRepoRoot(): string {
  // Try to find the repo root from current working directory
  try {
    const root = execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return root;
  } catch {
    // Fall back to script location detection (for when running from installed location)
    const scriptPath = realpathSync(process.argv[1] ?? "");
    // Assume script is in packages/mage-dev/dist/
    return dirname(dirname(dirname(dirname(scriptPath))));
  }
}

export const REPO_ROOT = findRepoRoot();
export const REPO_NAME = basename(REPO_ROOT);

// Default worktree location (can be overridden with MAGE_KNIGHT_WORKTREES env var)
export const WORKTREE_BASE =
  process.env["MAGE_KNIGHT_WORKTREES"] ??
  `${homedir()}/.claude-worktrees/${REPO_NAME}`;

export function getWorktreePath(name: string): string {
  if (name === "main") {
    return REPO_ROOT;
  }
  return `${WORKTREE_BASE}/${name}`;
}

export function worktreeExists(name: string): boolean {
  const path = getWorktreePath(name);
  return existsSync(path) && existsSync(`${path}/.git`);
}
