import { execSync, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";
import { REPO_ROOT } from "./config.js";

const LOG_DIR = path.join(
  homedir(),
  ".claude-cache",
  "mage-knight",
  "agent-logs"
);

// Must match parallel-implement.sh - uses lowercase "mage-knight"
const AGENT_WORKTREE_BASE = path.join(
  homedir(),
  ".claude-worktrees",
  "mage-knight"
);

const SCRIPTS_DIR = path.join(REPO_ROOT, ".claude", "scripts");

// Cache directory where select-issue.cjs stores issue data
const CACHE_DIR = path.join(homedir(), ".claude-cache", "mage-knight");

interface CachedIssue {
  number: number;
  title: string;
  labels: { name: string }[];
}

// Load issue titles from cache (populated by select-issue.cjs)
function getIssueTitles(): Map<number, string> {
  const titles = new Map<number, string>();
  const issuesFile = path.join(CACHE_DIR, "issues.json");

  try {
    if (fs.existsSync(issuesFile)) {
      const issues: CachedIssue[] = JSON.parse(fs.readFileSync(issuesFile, "utf-8"));
      for (const issue of issues) {
        titles.set(issue.number, issue.title);
      }
    }
  } catch {
    // Cache may not exist or be invalid
  }

  return titles;
}

export interface Agent {
  issueNumber: number;
  issueTitle?: string;
  worktreePath: string;
  worktreeName: string;
  pid: number | null;
  status: "running" | "stopped" | "completed" | "failed" | "initializing";
  logFile: string | null;
  startTime: Date | null;
  lastLogLine?: string | undefined;
}

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function findClaudeBin(): string {
  const localPath = path.join(homedir(), ".claude", "local", "claude");
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  return "claude"; // Fall back to PATH
}

export function getAgents(): Agent[] {
  ensureLogDir();
  const agents: Agent[] = [];
  const realIssueNumbers = new Set<number>();
  const issueTitles = getIssueTitles();

  // Find all PID files (real agents)
  const pidFiles = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".pid"));

  for (const pidFile of pidFiles) {
    const match = pidFile.match(/^agent-(\d+)\.pid$/);
    if (!match?.[1]) continue;

    const issueNumber = parseInt(match[1], 10);
    realIssueNumbers.add(issueNumber);
    const pidPath = path.join(LOG_DIR, pidFile);
    const pid = parseInt(fs.readFileSync(pidPath, "utf-8").trim(), 10);

    // Find matching log file
    const logFiles = fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.startsWith(`agent-${issueNumber}-`) && f.endsWith(".log"))
      .sort()
      .reverse();
    const logFile = logFiles[0] ? path.join(LOG_DIR, logFiles[0]) : null;

    // Check if process is running
    let isRunning = false;
    try {
      process.kill(pid, 0); // Signal 0 just checks if process exists
      isRunning = true;
    } catch {
      isRunning = false;
    }

    // Get last log line from Claude's JSONL if available
    let lastLogLine: string | undefined;
    const claudeLog = getAgentLog(issueNumber, 1);
    if (claudeLog.length > 0) {
      lastLogLine = claudeLog[claudeLog.length - 1]?.slice(0, 80);
    }

    // Determine worktree path from issue
    const worktreeName = `issue-${issueNumber}`;
    let worktreePath = "";
    try {
      const matchingDir = fs.readdirSync(AGENT_WORKTREE_BASE).find((d) => d.startsWith(worktreeName));
      if (matchingDir) {
        worktreePath = path.join(AGENT_WORKTREE_BASE, matchingDir);
      }
    } catch {
      // AGENT_WORKTREE_BASE may not exist
    }

    // Determine status - check Claude's JSONL for completion
    let status: Agent["status"] = "stopped";
    if (isRunning) {
      status = "running";
    } else {
      const fullLog = getAgentLog(issueNumber, 100);
      const logText = fullLog.join("\n");
      if (logText.includes("Implementation Complete") || logText.includes("PR Link:")) {
        status = "completed";
      } else if (logText.includes("[ERROR]") || logText.includes("failed")) {
        status = "failed";
      }
    }

    const title = issueTitles.get(issueNumber);
    agents.push({
      issueNumber,
      ...(title && { issueTitle: title }),
      worktreePath,
      worktreeName: path.basename(worktreePath) || worktreeName,
      pid: isRunning ? pid : null,
      status,
      logFile,
      startTime: logFile ? fs.statSync(logFile).birthtime : null,
      lastLogLine,
    });
  }

  // Find status files from agents being set up
  const statusFiles = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".status"));
  const STATUS_TIMEOUT = 5 * 60 * 1000; // 5 minutes - should be plenty for setup

  const stepLabels: Record<string, string> = {
    selecting: "Selecting issue...",
    claiming: "Claiming issue...",
    fetching_title: "Fetching issue title...",
    creating_worktree: "Creating git worktree...",
    installing_deps: "Running bun install...",
    launching: "Starting Claude agent...",
    failed: "Setup failed",
  };

  for (const statusFile of statusFiles) {
    const statusPath = path.join(LOG_DIR, statusFile);
    try {
      const content = JSON.parse(fs.readFileSync(statusPath, "utf-8"));
      const age = Date.now() - content.timestamp;

      // Remove stale status files
      if (age > STATUS_TIMEOUT) {
        fs.unlinkSync(statusPath);
        continue;
      }

      // Skip if we already have this agent via PID file
      if (realIssueNumbers.has(content.issue)) {
        fs.unlinkSync(statusPath);
        continue;
      }

      const elapsedSec = Math.floor(age / 1000);
      const stepLabel = stepLabels[content.step] || content.detail || "Initializing...";
      const title = issueTitles.get(content.issue);

      agents.push({
        issueNumber: content.issue,
        ...(title && { issueTitle: title }),
        worktreePath: "",
        worktreeName: `issue-${content.issue}`,
        pid: null,
        status: content.step === "failed" ? "failed" : "initializing",
        logFile: null,
        startTime: new Date(content.timestamp),
        lastLogLine: `${stepLabel} (${elapsedSec}s)`,
      });
    } catch {
      // Invalid status file, remove it
      fs.unlinkSync(statusPath);
    }
  }

  // Check for setup status files (issue selection/claiming phase)
  const setupFiles = fs.readdirSync(LOG_DIR).filter((f) => f.startsWith("setup-") && f.endsWith(".status"));

  for (const setupFile of setupFiles) {
    const setupPath = path.join(LOG_DIR, setupFile);
    try {
      const content = JSON.parse(fs.readFileSync(setupPath, "utf-8"));
      const age = Date.now() - content.timestamp;

      if (age > STATUS_TIMEOUT) {
        fs.unlinkSync(setupPath);
        continue;
      }

      const elapsedSec = Math.floor(age / 1000);
      const stepLabel = stepLabels[content.step] || content.detail || "Initializing...";

      agents.push({
        issueNumber: 0,
        worktreePath: "",
        worktreeName: `Agent ${content.slot}`,
        pid: null,
        status: "initializing",
        logFile: null,
        startTime: new Date(content.timestamp),
        lastLogLine: `${stepLabel} (${elapsedSec}s)`,
      });
    } catch {
      fs.unlinkSync(setupPath);
    }
  }

  // Also check for legacy pending markers (backwards compatibility)
  const pendingFiles = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".marker"));
  const PENDING_TIMEOUT = 3 * 60 * 1000;

  for (const pendingFile of pendingFiles) {
    const pendingPath = path.join(LOG_DIR, pendingFile);
    try {
      const content = JSON.parse(fs.readFileSync(pendingPath, "utf-8"));
      const age = Date.now() - content.timestamp;

      if (age > PENDING_TIMEOUT) {
        fs.unlinkSync(pendingPath);
        continue;
      }

      const elapsedSec = Math.floor(age / 1000);
      agents.push({
        issueNumber: 0,
        worktreePath: "",
        worktreeName: `Initializing (${content.index + 1}/${content.count})`,
        pid: null,
        status: "initializing",
        logFile: null,
        startTime: new Date(content.timestamp),
        lastLogLine: `Setting up... (${elapsedSec}s)`,
      });
    } catch {
      fs.unlinkSync(pendingPath);
    }
  }

  return agents.sort((a, b) => a.issueNumber - b.issueNumber);
}

export function getAgentLog(issueNumber: number, lines = 50): string[] {
  // Try to find Claude's JSONL log for this agent's worktree
  const claudeProjectsDir = path.join(homedir(), ".claude", "projects");

  if (fs.existsSync(claudeProjectsDir)) {
    // Find project dir matching this issue's worktree
    const projectDirs = fs.readdirSync(claudeProjectsDir).filter((d) =>
      d.includes(`issue-${issueNumber}`)
    );

    for (const projectDir of projectDirs) {
      const projectPath = path.join(claudeProjectsDir, projectDir);
      const jsonlFiles = fs
        .readdirSync(projectPath)
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => ({
          name: f,
          mtime: fs.statSync(path.join(projectPath, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (jsonlFiles.length > 0 && jsonlFiles[0]) {
        const jsonlFile = path.join(projectPath, jsonlFiles[0].name);
        try {
          const content = fs.readFileSync(jsonlFile, "utf-8");
          const logLines: string[] = [];

          // Parse JSONL and extract relevant messages
          for (const line of content.split("\n")) {
            if (!line.trim()) continue;
            try {
              const entry = JSON.parse(line);
              // Extract assistant messages and tool uses
              if (entry.type === "assistant" && entry.message?.content) {
                for (const block of entry.message.content) {
                  if (block.type === "text" && block.text) {
                    // Truncate long lines
                    const text = block.text.slice(0, 200);
                    if (text.trim()) {
                      logLines.push(text.split("\n")[0] ?? "");
                    }
                  } else if (block.type === "tool_use") {
                    // Extract useful info from tool inputs
                    const input = block.input ?? {};
                    let detail = "";
                    if (block.name === "Bash" && input.command) {
                      detail = `: ${String(input.command).slice(0, 60)}`;
                    } else if (block.name === "Edit" && input.file_path) {
                      detail = `: ${String(input.file_path).split("/").pop()}`;
                    } else if (block.name === "Write" && input.file_path) {
                      detail = `: ${String(input.file_path).split("/").pop()}`;
                    } else if (block.name === "Read" && input.file_path) {
                      detail = `: ${String(input.file_path).split("/").pop()}`;
                    } else if (block.name === "Task" && input.description) {
                      detail = `: ${String(input.description).slice(0, 40)}`;
                    } else if (block.name === "Grep" && input.pattern) {
                      detail = `: "${String(input.pattern).slice(0, 30)}"`;
                    } else if (block.name === "Glob" && input.pattern) {
                      detail = `: ${String(input.pattern)}`;
                    } else if (block.name === "TodoWrite") {
                      // Show count of todos being written
                      const todos = input.todos;
                      if (Array.isArray(todos)) {
                        const inProgress = todos.filter((t: { status?: string }) => t.status === "in_progress");
                        const pending = todos.filter((t: { status?: string }) => t.status === "pending");
                        detail = `: ${inProgress.length} active, ${pending.length} pending`;
                      }
                    } else if (block.name === "WebFetch" && input.url) {
                      detail = `: ${String(input.url).slice(0, 40)}`;
                    } else if (block.name === "WebSearch" && input.query) {
                      detail = `: "${String(input.query).slice(0, 30)}"`;
                    } else if (block.name === "Skill" && input.skill) {
                      detail = `: /${String(input.skill)}`;
                    } else if (block.name?.startsWith("mcp__")) {
                      // MCP tools - extract the tool name after mcp__server__
                      const mcpMatch = block.name.match(/mcp__[^_]+__(.+)/);
                      if (mcpMatch) {
                        detail = `: ${mcpMatch[1]}`;
                      }
                    }
                    logLines.push(`[${block.name}${detail}]`);
                  }
                }
              }
            } catch {
              // Skip invalid JSON lines
            }
          }

          return logLines.slice(-lines);
        } catch {
          // Fall through to legacy log
        }
      }
    }
  }

  // Fallback to legacy log file
  if (!fs.existsSync(LOG_DIR)) return [];

  const logFiles = fs
    .readdirSync(LOG_DIR)
    .filter((f) => f.startsWith(`agent-${issueNumber}-`) && f.endsWith(".log"))
    .sort()
    .reverse();

  const firstLog = logFiles[0];
  if (!firstLog) return [];

  const logFile = path.join(LOG_DIR, firstLog);
  if (!fs.existsSync(logFile)) return [];

  const content = fs.readFileSync(logFile, "utf-8");
  return content.split("\n").slice(-lines);
}

export interface LaunchResult {
  success: boolean;
  issueNumber?: number;
  error?: string;
}

export function selectAndClaimIssue(): { success: boolean; issueNumber?: number; error?: string } {
  try {
    const selectScript = path.join(SCRIPTS_DIR, "select-issue.cjs");

    // Select issue
    const issueStr = execSync(`node "${selectScript}" --refresh`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000, // 30 second timeout
    }).trim();

    const issueNumber = parseInt(issueStr, 10);
    if (isNaN(issueNumber)) {
      return { success: false, error: "No eligible issues found" };
    }

    // Claim it
    execSync(`node "${selectScript}" --claim ${issueNumber}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000,
    });

    return { success: true, issueNumber };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function launchAgentsInBackground(
  count: number,
  issueNumbers?: number[]
): { success: boolean; error?: string } {
  const parallelScript = path.join(SCRIPTS_DIR, "parallel-implement.sh");

  if (!fs.existsSync(parallelScript)) {
    return { success: false, error: `parallel-implement.sh not found at ${parallelScript}` };
  }

  try {
    ensureLogDir();

    // Build args: count first, then optional issue numbers
    const actualCount = issueNumbers?.length ?? count;
    const args = [parallelScript, String(actualCount)];
    if (issueNumbers && issueNumbers.length > 0) {
      args.push(...issueNumbers.map(String));
    }

    // Spawn the parallel script in background
    // Script writes its own status files as it progresses
    const child = spawn("bash", args, {
      cwd: REPO_ROOT,
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export function launchAgent(issueNumber: number, worktreePath: string): LaunchResult {
  ensureLogDir();

  const claudeBin = findClaudeBin();
  const logFile = path.join(LOG_DIR, `agent-${issueNumber}-${Date.now()}.log`);
  const pidFile = path.join(LOG_DIR, `agent-${issueNumber}.pid`);

  try {
    // Launch Claude in background
    const child = spawn(
      claudeBin,
      ["--dangerously-skip-permissions", "-p", `/implement #${issueNumber}`],
      {
        cwd: worktreePath,
        detached: true,
        stdio: ["ignore", fs.openSync(logFile, "w"), fs.openSync(logFile, "a")],
      }
    );

    child.unref();
    fs.writeFileSync(pidFile, String(child.pid));

    return { success: true, issueNumber };
  } catch (err) {
    return { success: false, issueNumber, error: String(err) };
  }
}

export function killAgent(issueNumber: number): { success: boolean; error?: string } {
  const pidFile = path.join(LOG_DIR, `agent-${issueNumber}.pid`);

  if (!fs.existsSync(pidFile)) {
    return { success: false, error: "No PID file found" };
  }

  try {
    const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
    process.kill(pid, "SIGTERM");
    fs.unlinkSync(pidFile);
    return { success: true };
  } catch {
    // Process might already be dead
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }
    return { success: true };
  }
}

export function getAgentPrUrl(agent: Agent): string | null {
  if (!agent.worktreeName) return null;

  try {
    // Query GitHub for PR with this branch as head
    const result = execSync(
      `gh pr list --head "${agent.worktreeName}" --json url --limit 1`,
      {
        cwd: REPO_ROOT,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10000,
      }
    );

    const prs = JSON.parse(result.trim());
    if (Array.isArray(prs) && prs.length > 0 && prs[0]?.url) {
      return prs[0].url as string;
    }
    return null;
  } catch {
    return null;
  }
}

export function openAgentPr(agent: Agent): { success: boolean; error?: string; url?: string } {
  const url = getAgentPrUrl(agent);

  if (!url) {
    return { success: false, error: "No PR found for this agent" };
  }

  try {
    const { platform } = process;
    const command =
      platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
    execSync(`${command} "${url}"`, { stdio: "pipe" });
    return { success: true, url };
  } catch {
    return { success: false, error: "Failed to open browser" };
  }
}

export function cleanupCompletedAgents(): number {
  const agents = getAgents();
  let cleaned = 0;

  for (const agent of agents) {
    // Clean up any non-running agent (completed, stopped, or failed)
    if (agent.status !== "running" && agent.status !== "initializing") {
      const pidFile = path.join(LOG_DIR, `agent-${agent.issueNumber}.pid`);
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
        cleaned++;
      }
    }
  }

  return cleaned;
}
