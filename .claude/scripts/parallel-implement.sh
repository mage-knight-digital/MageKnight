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

# Select and claim issues
ISSUES=()
for i in $(seq 1 $COUNT); do
  # Check if we have a specific issue for this slot
  IDX=$((i - 1))
  if [ $IDX -lt ${#SPECIFIC_ISSUES[@]} ] && [ -n "${SPECIFIC_ISSUES[$IDX]}" ]; then
    ISSUE="${SPECIFIC_ISSUES[$IDX]}"
    log "Using specified issue #$ISSUE..."

    # Still claim it to update the board status
    node "$SCRIPT_DIR/select-issue.cjs" --claim "$ISSUE" >/dev/null 2>&1 || {
      error "Failed to claim issue #$ISSUE"
      continue
    }
  else
    log "Selecting issue $i of $COUNT..."

    # Add random delay to reduce race conditions
    sleep $((RANDOM % 3))

    # Select and claim
    ISSUE=$(node "$SCRIPT_DIR/select-issue.cjs" --refresh 2>/dev/null) || {
      error "Failed to select issue $i"
      continue
    }

    # Claim it
    node "$SCRIPT_DIR/select-issue.cjs" --claim "$ISSUE" >/dev/null 2>&1 || {
      error "Failed to claim issue #$ISSUE"
      continue
    }
  fi

  ISSUES+=("$ISSUE")
  success "Claimed issue #$ISSUE"
done

if [ ${#ISSUES[@]} -eq 0 ]; then
  error "No issues could be claimed"
  exit 1
fi

log "Claimed ${#ISSUES[@]} issues: ${ISSUES[*]}"

# Launch agents
cd "$REPO_ROOT"
PIDS=()

for ISSUE in "${ISSUES[@]}"; do
  # Get issue title for branch name
  APP_TOKEN=$(node "$SCRIPT_DIR/github-app-token.cjs")
  TITLE=$(GH_TOKEN=$APP_TOKEN gh issue view "$ISSUE" --json title -q '.title' 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g' | cut -c1-30)
  BRANCH_NAME="issue-${ISSUE}-${TITLE}"
  WORKTREE_PATH="$WORKTREE_BASE/$BRANCH_NAME"

  # Check if worktree already exists
  if [ -d "$WORKTREE_PATH" ]; then
    log "Worktree already exists for #$ISSUE, reusing..."
  else
    # Fetch latest main and create worktree
    git fetch origin main 2>/dev/null
    git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME" origin/main 2>/dev/null || {
      error "Failed to create worktree for #$ISSUE"
      node "$SCRIPT_DIR/select-issue.cjs" --unclaim "$ISSUE" 2>/dev/null
      continue
    }
  fi

  # Install dependencies in worktree
  log "Installing dependencies for #$ISSUE..."
  (cd "$WORKTREE_PATH" && pnpm install --silent 2>/dev/null) || {
    error "Failed to install dependencies for #$ISSUE"
    continue
  }

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

  success "Agent for #$ISSUE started (PID: $AGENT_PID, log: $LOGFILE)"
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
