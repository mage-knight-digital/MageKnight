#!/bin/bash
#
# Parallel Implementation Launcher
#
# Launches multiple Claude Code instances to implement issues in parallel.
# Each instance runs in its own git worktree for isolation.
#
# Usage:
#   ./parallel-implement.sh [count]   # Launch N agents (default: 3)
#   ./parallel-implement.sh --status  # Check status of running agents
#   ./parallel-implement.sh --cleanup # Clean up completed worktrees
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKTREE_BASE="$HOME/.claude-worktrees/mage-knight"
LOG_DIR="$HOME/.claude-cache/mage-knight/agent-logs"

# Default number of parallel agents
COUNT=${1:-3}
shift 2>/dev/null || true  # Remove count from args
SPECIFIC_ISSUES=("$@")     # Remaining args are specific issue numbers

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
  echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Handle --status flag
if [ "$1" == "--status" ]; then
  echo "=== Active Agent Sessions ==="
  if [ -d "$LOG_DIR" ]; then
    for logfile in "$LOG_DIR"/*.log; do
      if [ -f "$logfile" ]; then
        AGENT_NAME=$(basename "$logfile" .log)
        PID_FILE="$LOG_DIR/${AGENT_NAME}.pid"
        if [ -f "$PID_FILE" ]; then
          PID=$(cat "$PID_FILE")
          if ps -p "$PID" > /dev/null 2>&1; then
            echo -e "${GREEN}RUNNING${NC}: $AGENT_NAME (PID: $PID)"
            tail -1 "$logfile" 2>/dev/null | head -c 100
            echo ""
          else
            echo -e "${YELLOW}STOPPED${NC}: $AGENT_NAME"
          fi
        fi
      fi
    done
  else
    echo "No agent logs found"
  fi
  exit 0
fi

# Handle --cleanup flag
if [ "$1" == "--cleanup" ]; then
  echo "=== Cleaning Up Completed Worktrees ==="
  cd "$REPO_ROOT"
  for wt in $(git worktree list --porcelain | grep "^worktree" | cut -d' ' -f2); do
    if [[ "$wt" == "$WORKTREE_BASE"* ]]; then
      BRANCH=$(git worktree list --porcelain | grep -A2 "^worktree $wt$" | grep "^branch" | cut -d'/' -f3-)
      # Check if branch has been merged to main
      if git branch --merged main | grep -q "$BRANCH" 2>/dev/null; then
        log "Removing merged worktree: $wt"
        git worktree remove "$wt" --force 2>/dev/null || true
      else
        log "Keeping unmerged worktree: $wt ($BRANCH)"
      fi
    fi
  done
  # Clean up old log files
  find "$LOG_DIR" -name "*.log" -mtime +1 -delete 2>/dev/null || true
  find "$LOG_DIR" -name "*.pid" -mtime +1 -delete 2>/dev/null || true
  success "Cleanup complete"
  exit 0
fi

# Ensure directories exist
mkdir -p "$WORKTREE_BASE"
mkdir -p "$LOG_DIR"

# Find Claude CLI (check common locations since aliases don't work in scripts)
CLAUDE_BIN=""
if [ -x "$HOME/.claude/local/claude" ]; then
  CLAUDE_BIN="$HOME/.claude/local/claude"
elif command -v claude &> /dev/null; then
  CLAUDE_BIN="claude"
else
  error "Claude CLI not found. Checked: ~/.claude/local/claude and PATH"
  exit 1
fi
log "Using Claude at: $CLAUDE_BIN"

log "Starting $COUNT parallel implementation agents..."

# Helper to write status for agents that don't have an issue number yet
write_setup_status() {
  local slot=$1
  local step=$2
  local detail=$3
  echo "{\"issue\":0,\"slot\":$slot,\"step\":\"$step\",\"detail\":\"$detail\",\"timestamp\":$(date +%s)000}" > "$LOG_DIR/setup-${slot}.status"
}

cleanup_setup_status() {
  local slot=$1
  rm -f "$LOG_DIR/setup-${slot}.status"
}

# Select and claim issues (or use provided ones directly)
ISSUES=()

# Fast path: if all issues are explicitly provided, skip selection/claiming entirely
if [ ${#SPECIFIC_ISSUES[@]} -ge $COUNT ]; then
  log "Using provided issues directly (skipping selection/claiming)..."
  for i in $(seq 1 $COUNT); do
    IDX=$((i - 1))
    ISSUES+=("${SPECIFIC_ISSUES[$IDX]}")
  done
  log "Issues: ${ISSUES[*]}"
else
  # Slow path: need to select/claim some or all issues
  for i in $(seq 1 $COUNT); do
    IDX=$((i - 1))
    if [ $IDX -lt ${#SPECIFIC_ISSUES[@]} ] && [ -n "${SPECIFIC_ISSUES[$IDX]}" ]; then
      ISSUE="${SPECIFIC_ISSUES[$IDX]}"
      write_setup_status $i "claiming" "Claiming issue #$ISSUE..."
      log "Using specified issue #$ISSUE..."

      # Still claim it to update the board status
      node "$SCRIPT_DIR/select-issue.cjs" --claim "$ISSUE" >/dev/null 2>&1 || {
        error "Failed to claim issue #$ISSUE"
        cleanup_setup_status $i
        continue
      }
    else
      write_setup_status $i "selecting" "Selecting issue $i of $COUNT..."
      log "Selecting issue $i of $COUNT..."

      # Add random delay to reduce race conditions
      sleep $((RANDOM % 3))

      # Select and claim
      ISSUE=$(node "$SCRIPT_DIR/select-issue.cjs" --refresh 2>/dev/null) || {
        error "Failed to select issue $i"
        cleanup_setup_status $i
        continue
      }

      write_setup_status $i "claiming" "Claiming issue #$ISSUE..."

      # Claim it
      node "$SCRIPT_DIR/select-issue.cjs" --claim "$ISSUE" >/dev/null 2>&1 || {
        error "Failed to claim issue #$ISSUE"
        cleanup_setup_status $i
        continue
      }
    fi

    cleanup_setup_status $i
    ISSUES+=("$ISSUE")
    success "Claimed issue #$ISSUE"
  done
fi

if [ ${#ISSUES[@]} -eq 0 ]; then
  error "No issues could be claimed"
  exit 1
fi

log "Claimed ${#ISSUES[@]} issues: ${ISSUES[*]}"

# Launch agents
cd "$REPO_ROOT"
PIDS=()

AGENT_INDEX=0
for ISSUE in "${ISSUES[@]}"; do
  # Update status marker for this agent
  MARKER_FILE="$LOG_DIR/agent-${ISSUE}.status"
  update_status() {
    echo "{\"issue\":$ISSUE,\"step\":\"$1\",\"detail\":\"$2\",\"timestamp\":$(date +%s)000}" > "$MARKER_FILE"
  }
  # Get issue title for branch name (skip API call if we have cached data or use simple name)
  TITLE=""
  CACHED_ISSUES="$HOME/.claude-cache/mage-knight/issues.json"
  if [ -f "$CACHED_ISSUES" ]; then
    # Try to get title from cache (populated by select-issue.cjs)
    TITLE=$(jq -r ".[] | select(.number == $ISSUE) | .title" "$CACHED_ISSUES" 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g' | cut -c1-30)
  fi

  if [ -z "$TITLE" ]; then
    # Fall back to API call only if no cache
    update_status "fetching_title" "Getting issue title..."
    APP_TOKEN=$(node "$SCRIPT_DIR/github-app-token.cjs" 2>/dev/null) || true
    if [ -n "$APP_TOKEN" ]; then
      TITLE=$(GH_TOKEN=$APP_TOKEN gh issue view "$ISSUE" --json title -q '.title' 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g' | cut -c1-30)
    fi
  fi

  # Use simple branch name if we couldn't get title
  if [ -n "$TITLE" ]; then
    BRANCH_NAME="issue-${ISSUE}-${TITLE}"
  else
    BRANCH_NAME="issue-${ISSUE}"
  fi
  WORKTREE_PATH="$WORKTREE_BASE/$BRANCH_NAME"

  # Check if worktree already exists
  if [ -d "$WORKTREE_PATH" ]; then
    log "Worktree already exists for #$ISSUE, reusing..."
  else
    update_status "creating_worktree" "Creating git worktree..."

    # Fetch latest main and create worktree
    git fetch origin main 2>/dev/null
    git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME" origin/main 2>/dev/null || {
      error "Failed to create worktree for #$ISSUE"
      update_status "failed" "Failed to create worktree"
      node "$SCRIPT_DIR/select-issue.cjs" --unclaim "$ISSUE" 2>/dev/null
      continue
    }
  fi

  update_status "installing_deps" "Running bun install..."

  # Install dependencies in worktree
  log "Installing dependencies for #$ISSUE..."
  (cd "$WORKTREE_PATH" && bun install --silent 2>/dev/null) || {
    error "Failed to install dependencies for #$ISSUE"
    update_status "failed" "bun install failed"
    continue
  }

  update_status "launching" "Starting Claude agent..."

  # Log file for this agent
  LOGFILE="$LOG_DIR/agent-${ISSUE}-$(date +%Y%m%d-%H%M%S).log"
  PIDFILE="$LOG_DIR/agent-${ISSUE}.pid"

  # Launch Claude in background
  log "Launching agent for issue #$ISSUE..."
  (
    cd "$WORKTREE_PATH"
    "$CLAUDE_BIN" --dangerously-skip-permissions -p "/implement #$ISSUE" 2>&1
  ) > "$LOGFILE" 2>&1 &

  AGENT_PID=$!
  echo "$AGENT_PID" > "$PIDFILE"
  PIDS+=("$AGENT_PID")

  # Remove status marker now that agent is running (PID file takes over)
  rm -f "$MARKER_FILE"

  success "Agent for #$ISSUE started (PID: $AGENT_PID, log: $LOGFILE)"
  AGENT_INDEX=$((AGENT_INDEX + 1))
done

echo ""
log "=== Summary ==="
echo "Launched ${#PIDS[@]} agents"
echo ""
echo "Monitor progress:"
echo "  $0 --status"
echo ""
echo "View logs:"
echo "  tail -f $LOG_DIR/agent-*.log"
echo ""
echo "Cleanup after PRs merged:"
echo "  $0 --cleanup"
