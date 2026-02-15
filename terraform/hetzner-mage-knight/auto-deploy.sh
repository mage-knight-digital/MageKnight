#!/bin/bash
set -euo pipefail

REPO=/root/MageKnight
LOCK=/tmp/mage-knight-deploy.lock
LOG=/var/log/mage-knight-deploy.log

# Prevent concurrent runs
exec 200>"$LOCK"
flock -n 200 || exit 0

cd "$REPO"

# Fetch and check if HEAD changed
git fetch origin main --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
fi

echo "$(date -u +%FT%TZ) Deploying $LOCAL -> $REMOTE" >> "$LOG"

# Pull
git pull --ff-only

# Rebuild
export PATH=/root/.bun/bin:$PATH
bun install >> "$LOG" 2>&1
bun run build >> "$LOG" 2>&1

# Kill running sweep before restarting server
tmux kill-session -t sweep 2>/dev/null || true

# Kill any rogue process holding port 3001 (e.g. leftover nohup bun)
fuser -k 3001/tcp 2>/dev/null || true
sleep 1

# Restart server via systemd
systemctl restart mage-knight-server

# Wait for server to accept connections
for i in $(seq 1 15); do
    if curl -s http://127.0.0.1:3001 > /dev/null 2>&1; then
        echo "$(date -u +%FT%TZ) Server ready after ${i}s" >> "$LOG"
        break
    fi
    if [ "$i" -eq 15 ]; then
        echo "$(date -u +%FT%TZ) ERROR: Server not ready after 15s, aborting" >> "$LOG"
        exit 1
    fi
    sleep 1
done

# Reinstall Python SDK
cd packages/python-sdk
source venv/bin/activate
pip install -e . -q >> "$LOG" 2>&1

# Disk cleanup: remove old summary and failure artifacts, truncate sweep log
rm -f sim-artifacts/run_summary.ndjson
rm -f sim-artifacts/run_*.json
truncate -s 0 /tmp/sweep-1M.log 2>/dev/null || true

# Keep deploy log under 1MB
if [ -f "$LOG" ]; then
    log_size=$(stat -c%s "$LOG" 2>/dev/null || stat -f%z "$LOG")
    if [ "$log_size" -gt 1048576 ]; then
        tail -100 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
    fi
fi

# Launch fresh sweep (close flock fd before tmux to avoid inheritance)
exec 200>&-
tmux new-session -d -s sweep bash
tmux send-keys -t sweep "cd /root/MageKnight/packages/python-sdk && source venv/bin/activate && mage-knight-run-sweep --runs 1000000 --no-undo --workers 2 > /tmp/sweep-1M.log 2>&1" Enter

echo "$(date -u +%FT%TZ) Deploy complete, sweep launched ($(git rev-parse --short HEAD))" >> "$LOG"
