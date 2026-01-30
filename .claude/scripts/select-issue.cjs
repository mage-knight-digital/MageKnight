#!/usr/bin/env node

/**
 * Issue Selection Script for MageKnight
 *
 * Selects the highest priority issue based on:
 * 1. Priority (P0 > P1 > P2 > P3/unlabeled)
 * 2. Type (bugs before features at same priority)
 * 3. Age (lower issue number = older = first)
 *
 * Caches GitHub data locally with 5-minute TTL.
 * Updates cache immediately on claim for parallel agent coordination.
 *
 * Usage:
 *   node select-issue.js           # Select best issue
 *   node select-issue.js --refresh # Force cache refresh
 *   node select-issue.js --claim N # Mark issue N as claimed (updates local cache)
 *   node select-issue.js --details N # Get issue details from cache
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");

// === Configuration ===
const CACHE_DIR = path.join(
  process.env.HOME,
  ".claude-cache",
  "mage-knight"
);
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const OWNER = "mage-knight-digital";
const REPO = "MageKnight";
const PROJECT_NUMBER = 2;

// Project board field IDs (org-level project)
const PROJECT_ID = "PVT_kwDOD2L9IM4BN1Jh";
const STATUS_FIELD_ID = "PVTSSF_lADOD2L9IM4BN1Jhzg8tixg";
const IN_PROGRESS_OPTION_ID = "47fc9ee4";
const BACKLOG_OPTION_ID = "f75ad846"; // "Todo" in new project

// === Cache Functions ===

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCachePath(name) {
  return path.join(CACHE_DIR, `${name}.json`);
}

function readCache(name) {
  const cachePath = getCachePath(name);
  if (!fs.existsSync(cachePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(cachePath, "utf-8");
    return JSON.parse(content);
  } catch {
    // Cache corrupted, delete it
    fs.unlinkSync(cachePath);
    return null;
  }
}

function writeCache(name, data) {
  ensureCacheDir();
  const cachePath = getCachePath(name);
  const cacheData = {
    timestamp: Date.now(),
    data,
  };
  fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
}

function isCacheValid(name) {
  const cache = readCache(name);
  if (!cache || !cache.timestamp) {
    return false;
  }
  return Date.now() - cache.timestamp < CACHE_TTL;
}

function getCachedData(name) {
  const cache = readCache(name);
  return cache ? cache.data : null;
}

// === GitHub API Functions ===

// Get GitHub App token (cached, higher rate limits)
// Note: App tokens work for repo-level resources (issues) but NOT user-level projects
function getAppToken() {
  const tokenScript = path.join(__dirname, "github-app-token.cjs");
  if (!fs.existsSync(tokenScript)) {
    return null; // Fall back to default gh auth
  }

  try {
    const token = execSync(`node "${tokenScript}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return token;
  } catch {
    return null; // Fall back to default gh auth
  }
}

// Cache the token for this process
let cachedAppToken = null;

function runGh(args, allowFailure = false, useAppToken = true) {
  // Get app token on first call
  if (cachedAppToken === null) {
    cachedAppToken = getAppToken() || false;
  }

  const env = { ...process.env };
  // Use app token for repo-level APIs (issues, graphql for blockers)
  // Don't use for project board (user-level, requires PAT)
  if (cachedAppToken && useAppToken) {
    env.GH_TOKEN = cachedAppToken;
  }

  try {
    const result = execSync(`gh ${args}`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large responses
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });
    return { success: true, data: result.trim() };
  } catch (error) {
    const errorMsg = error.stderr?.toString() || error.message;
    const isRateLimit = errorMsg.includes("rate limit") || errorMsg.includes("403");

    if (allowFailure) {
      return { success: false, error: errorMsg, isRateLimit };
    }

    console.error(`Error running gh ${args}:`, errorMsg);
    process.exit(1);
  }
}

function fetchIssues() {
  const result = runGh(
    `issue list --repo ${OWNER}/${REPO} --state open --limit 200 --json number,title,labels,body`,
    true
  );
  if (!result.success) {
    return null; // Signal to use cache
  }
  return JSON.parse(result.data);
}

function fetchBoard() {
  // Project board is user-level, requires PAT (not app token)
  const result = runGh(
    `project item-list ${PROJECT_NUMBER} --owner ${OWNER} --format json --limit 500`,
    true,
    false // Don't use app token for user-level projects
  );
  if (!result.success) {
    return null; // Signal to use cache
  }
  const data = JSON.parse(result.data);
  // Return a map of issue number -> status
  const statusMap = {};
  for (const item of data.items || []) {
    if (item.content && item.content.number) {
      statusMap[item.content.number] = {
        status: item.status,
        itemId: item.id,
      };
    }
  }
  return statusMap;
}

function fetchBlockers(issueNumbers) {
  // Fetch blockers for multiple issues in batches to reduce API calls
  const blockers = {};
  let hadRateLimit = false;

  // Build a single GraphQL query for all issues
  // (GitHub limits query complexity, so we batch in groups of 20)
  const batchSize = 20;

  for (let i = 0; i < issueNumbers.length; i += batchSize) {
    const batch = issueNumbers.slice(i, i + batchSize);
    const query = batch
      .map(
        (num, idx) =>
          `issue${idx}: issue(number: ${num}) { number blockedBy(first: 10) { nodes { state number } } }`
      )
      .join(" ");

    const graphqlQuery = `{ repository(owner: "${OWNER}", name: "${REPO}") { ${query} } }`;

    const result = runGh(`api graphql -f query='${graphqlQuery}'`, true);

    if (!result.success) {
      if (result.isRateLimit) {
        hadRateLimit = true;
      }
      // Mark batch as not blocked (graceful degradation)
      for (const num of batch) {
        blockers[num] = [];
      }
      continue;
    }

    try {
      const data = JSON.parse(result.data);
      const repo = data.data?.repository || {};

      for (const key of Object.keys(repo)) {
        const issue = repo[key];
        if (issue && issue.number) {
          const openBlockers = (issue.blockedBy?.nodes || [])
            .filter((b) => b.state === "OPEN")
            .map((b) => b.number);
          blockers[issue.number] = openBlockers;
        }
      }
    } catch {
      // Parse error, mark as not blocked
      for (const num of batch) {
        blockers[num] = [];
      }
    }
  }

  // Return null to signal we should use cache if rate limited
  if (hadRateLimit && Object.keys(blockers).length === 0) {
    return null;
  }

  return blockers;
}

// === Selection Logic ===

function getPriorityScore(labels) {
  const labelNames = labels.map((l) => l.name);
  if (labelNames.includes("P0-critical")) return 0;
  if (labelNames.includes("P1-high")) return 1;
  if (labelNames.includes("P2-medium")) return 2;
  return 3; // P3-low or unlabeled
}

function getTypeScore(labels) {
  const labelNames = labels.map((l) => l.name);
  if (labelNames.includes("bug")) return 0;
  return 1; // feature or other
}

function hasLabel(labels, labelName) {
  return labels.some((l) => l.name === labelName);
}

function parseBodyBlockers(body) {
  // Parse "Blocked By: #123" or "**Blocked By:** #123" patterns from issue body
  // Returns array of issue numbers mentioned as blockers
  if (!body) return [];

  const blockers = [];

  // Find all "Blocked By" sections and extract issue numbers after them
  // This handles: "Blocked By: #123", "**Blocked By:** #119", etc.
  const pattern = /Blocked\s*By[^#\n]*#(\d+)/gi;
  const matches = body.matchAll(pattern);

  for (const match of matches) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) {
      blockers.push(num);
    }
  }

  // Also check for multiple blockers on same line: "Blocked By: #123, #456"
  const multiPattern = /Blocked\s*By[^\n]*/gi;
  const lines = body.matchAll(multiPattern);
  for (const line of lines) {
    const issueRefs = line[0].match(/#(\d+)/g) || [];
    for (const ref of issueRefs) {
      const num = parseInt(ref.slice(1), 10);
      if (!isNaN(num) && !blockers.includes(num)) {
        blockers.push(num);
      }
    }
  }

  return blockers;
}

function getOpenIssueNumbers(issues) {
  // Build a set of open issue numbers for quick lookup
  return new Set(issues.map((i) => i.number));
}

function selectBestIssue(issues, board, blockers) {
  // Load exclusion list (issues rejected in this session)
  const excluded = getCachedData("excluded") || [];

  // Build set of open issue numbers for body-based blocker checks
  const openIssues = getOpenIssueNumbers(issues);

  // Filter candidates
  const candidates = issues.filter((issue) => {
    // Not in exclusion list
    if (excluded.includes(issue.number)) {
      return false;
    }

    // Not in progress
    const boardInfo = board[issue.number];
    if (boardInfo && boardInfo.status === "In Progress") {
      return false;
    }

    // Not an epic
    if (hasLabel(issue.labels, "epic")) {
      return false;
    }

    // Not needs-refinement (not ready for implementation)
    if (hasLabel(issue.labels, "needs-refinement")) {
      return false;
    }

    // Not blocked by open issues (GitHub API relationship)
    const issueBlockers = blockers[issue.number] || [];
    if (issueBlockers.length > 0) {
      return false;
    }

    // Not blocked by open issues (body text mentions)
    const bodyBlockers = parseBodyBlockers(issue.body);
    const openBodyBlockers = bodyBlockers.filter((num) => openIssues.has(num));
    if (openBodyBlockers.length > 0) {
      return false;
    }

    return true;
  });

  if (candidates.length === 0) {
    return null;
  }

  // Sort by: priority → type (bug first) → age (lower number = older = first)
  candidates.sort((a, b) => {
    // Priority (lower is higher priority)
    const priorityA = getPriorityScore(a.labels);
    const priorityB = getPriorityScore(b.labels);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Type (bugs before features)
    const typeA = getTypeScore(a.labels);
    const typeB = getTypeScore(b.labels);
    if (typeA !== typeB) {
      return typeA - typeB;
    }

    // Age (lower issue number = older = first)
    return a.number - b.number;
  });

  return candidates[0];
}

// === Cache Management ===

function loadOrFetchData(forceRefresh) {
  let issues, board, blockers;
  let usedStaleCache = false;

  // Try to fetch issues, fall back to any cached data if rate limited
  // Issues change rarely, so caching is fine
  if (!forceRefresh && isCacheValid("issues")) {
    issues = getCachedData("issues");
  } else {
    issues = fetchIssues();
    if (issues === null) {
      // API failed, try stale cache
      issues = getCachedData("issues");
      if (!issues) {
        console.error("No cached issues available and API failed");
        process.exit(1);
      }
      usedStaleCache = true;
      console.error("Note: Using stale cache due to API rate limit");
    } else {
      writeCache("issues", issues);
    }
  }

  // ALWAYS fetch fresh board data for parallel agent coordination
  // Board status is critical - another agent may have claimed an issue
  // With GitHub App (10k+ reqs/hour), we have plenty of headroom
  board = fetchBoard();
  if (board === null) {
    // API failed, try stale cache as fallback only
    board = getCachedData("board");
    if (!board) {
      board = {};
      console.error("Warning: Could not fetch board, treating all issues as available");
    } else {
      console.error("Warning: Using cached board data (API unavailable)");
    }
  } else {
    writeCache("board", board);
  }

  // Fetch blockers for all candidate issues
  const issueNumbers = issues.map((i) => i.number);

  if (!forceRefresh && isCacheValid("blockers")) {
    blockers = getCachedData("blockers");
  } else {
    blockers = fetchBlockers(issueNumbers);
    if (blockers === null) {
      // API failed, try stale cache
      blockers = getCachedData("blockers");
      if (!blockers) {
        // No cache - assume nothing is blocked
        blockers = {};
      }
    } else {
      writeCache("blockers", blockers);
    }
  }

  return { issues, board, blockers };
}

function verifyNotClaimedRemotely(issueNumber) {
  // Final verification that issue isn't already "In Progress" on GitHub
  // This catches the small race window between selection and claim
  // (Selection already fetches fresh board, but this is a safety check)
  const board = fetchBoard();

  if (board === null) {
    // Can't verify - proceed with caution (selection already got fresh data)
    console.error("Warning: Could not verify remote status, proceeding");
    return { verified: true, warning: true };
  }

  const boardInfo = board[issueNumber];
  if (boardInfo && boardInfo.status === "In Progress") {
    return { verified: false, reason: "already claimed on GitHub" };
  }

  return { verified: true };
}

function claimIssue(issueNumber) {
  // First check local cache (fast path)
  const board = getCachedData("board") || {};

  if (board[issueNumber]?.status === "In Progress") {
    console.error(`Issue #${issueNumber} is already claimed (local cache)`);
    process.exit(1);
  }

  // CRITICAL: Verify against remote GitHub before claiming
  // This catches race conditions where cache is stale
  const verification = verifyNotClaimedRemotely(issueNumber);
  if (!verification.verified) {
    console.error(`Issue #${issueNumber} is ${verification.reason}`);
    process.exit(1);
  }

  // Update cache with claimed status (instant local coordination)
  board[issueNumber] = {
    ...board[issueNumber],
    status: "In Progress",
  };
  writeCache("board", board);

  // Write pending claim to a file for the background worker
  const pendingClaimsPath = getCachePath("pending-claims");
  const pendingClaims = readCache("pending-claims")?.data || [];
  pendingClaims.push({
    issueNumber,
    timestamp: Date.now(),
    retries: 0,
  });
  writeCache("pending-claims", pendingClaims);

  // Get app token for the background worker
  const tokenScript = path.join(__dirname, "github-app-token.cjs");
  let appToken = "";
  try {
    appToken = execSync(`node "${tokenScript}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    // Will try without token
  }

  // Spawn background process to update GitHub (fire-and-forget with retries)
  const workerScript = `
    const { execSync } = require("child_process");
    const fs = require("fs");
    const path = require("path");

    const CACHE_DIR = "${CACHE_DIR}";
    const OWNER = "${OWNER}";
    const REPO = "${REPO}";
    const PROJECT_NUMBER = ${PROJECT_NUMBER};
    const PROJECT_ID = "${PROJECT_ID}";
    const STATUS_FIELD_ID = "${STATUS_FIELD_ID}";
    const IN_PROGRESS_OPTION_ID = "${IN_PROGRESS_OPTION_ID}";
    const issueNumber = ${issueNumber};
    const APP_TOKEN = "${appToken}";
    const MAX_RETRIES = 5;
    const INITIAL_DELAY = 2000; // 2 seconds

    // Set up environment with app token
    const env = { ...process.env };
    if (APP_TOKEN) {
      env.GH_TOKEN = APP_TOKEN;
    }

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    function updatePendingClaim(issueNum, update) {
      const pendingPath = path.join(CACHE_DIR, "pending-claims.json");
      try {
        const data = JSON.parse(fs.readFileSync(pendingPath, "utf-8"));
        const idx = data.data.findIndex(c => c.issueNumber === issueNum);
        if (idx !== -1) {
          if (update === null) {
            data.data.splice(idx, 1);
          } else {
            Object.assign(data.data[idx], update);
          }
          fs.writeFileSync(pendingPath, JSON.stringify(data, null, 2));
        }
      } catch (e) {
        // Ignore cache errors
      }
    }

    async function claimOnGitHub() {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // Add to project if not already there
          try {
            execSync(
              \`gh project item-add \${PROJECT_NUMBER} --owner \${OWNER} --url "https://github.com/\${OWNER}/\${REPO}/issues/\${issueNumber}" 2>/dev/null\`,
              { encoding: "utf-8", stdio: "pipe", env }
            );
          } catch {
            // Already in project, that's fine
          }

          // Get current board state
          const boardJson = execSync(
            \`gh project item-list \${PROJECT_NUMBER} --owner \${OWNER} --format json --limit 500\`,
            { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, env }
          );
          const boardData = JSON.parse(boardJson);
          const item = boardData.items?.find(i => i.content?.number === issueNumber);

          if (!item) {
            throw new Error(\`Issue #\${issueNumber} not found in project\`);
          }

          // Already claimed? We're done
          if (item.status === "In Progress") {
            updatePendingClaim(issueNumber, null);
            process.exit(0);
          }

          // Claim it
          execSync(
            \`gh project item-edit --project-id "\${PROJECT_ID}" --id "\${item.id}" --field-id "\${STATUS_FIELD_ID}" --single-select-option-id "\${IN_PROGRESS_OPTION_ID}"\`,
            { encoding: "utf-8", stdio: "pipe", env }
          );

          // Success - remove from pending
          updatePendingClaim(issueNumber, null);
          process.exit(0);

        } catch (error) {
          const isRateLimit = error.message?.includes("rate limit") ||
                              error.message?.includes("403") ||
                              error.message?.includes("secondary rate");

          if (isRateLimit && attempt < MAX_RETRIES - 1) {
            const delay = INITIAL_DELAY * Math.pow(2, attempt);
            updatePendingClaim(issueNumber, { retries: attempt + 1, lastError: "rate_limit" });
            await sleep(delay);
          } else if (attempt < MAX_RETRIES - 1) {
            const delay = INITIAL_DELAY * Math.pow(2, attempt);
            updatePendingClaim(issueNumber, { retries: attempt + 1, lastError: error.message });
            await sleep(delay);
          } else {
            // Final failure - log but don't crash
            updatePendingClaim(issueNumber, { failed: true, lastError: error.message });
            fs.appendFileSync(
              path.join(CACHE_DIR, "claim-errors.log"),
              \`[\${new Date().toISOString()}] Failed to claim #\${issueNumber} after \${MAX_RETRIES} attempts: \${error.message}\\n\`
            );
            process.exit(1);
          }
        }
      }
    }

    claimOnGitHub();
  `;

  // Spawn detached background process
  const child = spawn("node", ["-e", workerScript], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  // Output issue number immediately (don't wait for GitHub)
  console.log(issueNumber);
}

function getIssueDetails(issueNumber) {
  const issues = getCachedData("issues") || [];
  const issue = issues.find((i) => i.number === issueNumber);

  if (!issue) {
    // Not in cache, fetch directly
    const result = runGh(
      `issue view ${issueNumber} --repo ${OWNER}/${REPO} --json number,title,labels,body,state`,
      true
    );
    if (!result.success) {
      console.error(`Failed to fetch issue #${issueNumber}: ${result.error}`);
      process.exit(1);
    }
    console.log(result.data);
    return;
  }

  console.log(JSON.stringify(issue, null, 2));
}

function unclaimIssue(issueNumber) {
  // Update local cache to mark issue as NOT in progress
  const board = getCachedData("board") || {};
  if (board[issueNumber]) {
    board[issueNumber].status = "Backlog";
    writeCache("board", board);
  }

  // Add to exclusion list so it won't be re-selected this session
  const excluded = getCachedData("excluded") || [];
  if (!excluded.includes(issueNumber)) {
    excluded.push(issueNumber);
    writeCache("excluded", excluded);
  }

  console.log(`Unclaimed #${issueNumber} - will not be re-selected`);
}

function clearExcluded() {
  // Clear the exclusion list (for new session)
  writeCache("excluded", []);
  console.log("Cleared exclusion list");
}

// === CLI Interface ===

function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const forceRefresh = args.includes("--refresh");
  const claimIndex = args.indexOf("--claim");
  const detailsIndex = args.indexOf("--details");
  const unclaimIndex = args.indexOf("--unclaim");
  const clearExcludedFlag = args.includes("--clear-excluded");

  // Handle --claim
  if (claimIndex !== -1) {
    const issueNum = parseInt(args[claimIndex + 1], 10);
    if (isNaN(issueNum)) {
      console.error("Usage: select-issue.cjs --claim <issue-number>");
      process.exit(1);
    }
    claimIssue(issueNum);
    return;
  }

  // Handle --unclaim (move back to backlog, add to exclusion list)
  if (unclaimIndex !== -1) {
    const issueNum = parseInt(args[unclaimIndex + 1], 10);
    if (isNaN(issueNum)) {
      console.error("Usage: select-issue.cjs --unclaim <issue-number>");
      process.exit(1);
    }
    unclaimIssue(issueNum);
    return;
  }

  // Handle --clear-excluded (reset exclusion list for new session)
  if (clearExcludedFlag) {
    clearExcluded();
    return;
  }

  // Handle --details
  if (detailsIndex !== -1) {
    const issueNum = parseInt(args[detailsIndex + 1], 10);
    if (isNaN(issueNum)) {
      console.error("Usage: select-issue.cjs --details <issue-number>");
      process.exit(1);
    }
    getIssueDetails(issueNum);
    return;
  }

  // Default: select best issue
  const { issues, board, blockers } = loadOrFetchData(forceRefresh);
  const selected = selectBestIssue(issues, board, blockers);

  if (!selected) {
    console.error("No eligible issues found");
    process.exit(1);
  }

  // Output just the issue number
  console.log(selected.number);
}

main();
